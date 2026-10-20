import React, { useState, useEffect } from 'react';
import { Upload, X, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { validateAndProcessImageFile, MAX_PHOTO_SIZE_BYTES } from '../../utils/imageCompression';
import { resolveAssetUrl } from '../../utils/assetUrl';

export const ImageUploader = ({
  value,
  onChange,
  label = 'Profile Photo',
  required = false,
  locked = false,
  lockedTitle = 'Verified Identity Photo',
  lockedDescription = 'Your profile photo was verified during worker registration. Photo changes, replacements, and removal are permanently locked for account integrity and security.',
  onError,
}) => {
  const [preview, setPreview] = useState(resolveAssetUrl(value) || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setPreview(resolveAssetUrl(value) || '');
    setImgError(false);
  }, [value]);


  const handleFileChange = async (e) => {
    if (locked) return;

    const file = e.target.files?.[0];

    // Always reset the input so the user can re-select the same file after fixing it
    e.target.value = '';

    if (!file) return;

    // ── STEP 1: MIME type check (synchronous, before any I/O) ────────────────
    const fileType = file.type ? file.type.toLowerCase() : '';
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(fileType)) {
      const msg = 'Only JPG, JPEG, PNG, and WEBP images are allowed.';
      setErrorMessage(msg);
      if (onError) onError(msg);
      return;
    }

    // ── STEP 2: Size check via file.size (synchronous, before any I/O) ───────
    //
    //  file.size is the OS-reported binary byte count.
    //  This runs BEFORE FileReader so an oversized file never generates a preview.
    //
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      const sizeMB = (file.size / 1_000_000).toFixed(2);
      const msg = `Profile photo must be 1 MB or smaller. Your file is ${sizeMB} MB.`;
      setErrorMessage(msg);
      if (onError) onError(msg);
      // Do NOT update preview or call onChange — leave them unchanged
      return;
    }

    // ── STEP 3: Clear any previous error and read the file ───────────────────
    setErrorMessage('');

    try {
      const { dataUrl } = await validateAndProcessImageFile(file);
      setPreview(dataUrl);
      if (onChange) onChange(dataUrl);
    } catch (err) {
      const msg = err?.message || 'Profile photo must be 1 MB or smaller.';
      setErrorMessage(msg);
      if (onError) onError(msg);
      // Do NOT update preview or call onChange
    }
  };

  const handleRemove = () => {
    if (locked) return;
    setPreview('');
    setErrorMessage('');
    if (onChange) onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-300">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {locked && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            <Lock className="w-3 h-3" /> Permanently Locked
          </span>
        )}
      </div>

      {locked ? (
        /* ── READ-ONLY / LOCKED PROFILE PHOTO VIEW ───────────────────────── */
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-inner shrink-0">
            {preview && !imgError ? (
              <img
                src={preview}
                alt="Locked profile photo"
                className="w-full h-full object-cover select-none pointer-events-none"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                <Lock className="w-6 h-6 mb-1 text-slate-600" />
                <span className="text-[9px] text-slate-500">No Photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-slate-950/20 backdrop-brightness-95 pointer-events-none" />
            <div className="absolute bottom-1 right-1 p-1 rounded-full bg-slate-900/90 text-amber-400 shadow">
              <Lock className="w-3 h-3" />
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {lockedTitle}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm">
              {lockedDescription}
            </p>
          </div>
        </div>
      ) : (
        /* ── EDITABLE / REGISTRATION PHOTO UPLOAD VIEW ────────────────────── */
        <div className="space-y-2">
          {preview && !imgError ? (
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-brand-500/50 shadow-lg group">
              <img
                src={preview}
                alt="Upload preview"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
              <button
                type="button"
                onClick={handleRemove}
                title="Remove photo"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/80 text-rose-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl bg-slate-900/50 transition-all border-slate-700 hover:border-brand-500 cursor-pointer hover:bg-slate-900 group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-brand-400 transition-colors mb-2" />
                <p className="text-xs text-slate-400 font-medium">
                  Click to upload profile photo
                </p>
                <p className="text-[10px] text-slate-500 mt-1">JPG, PNG, WEBP — Max 1 MB</p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
