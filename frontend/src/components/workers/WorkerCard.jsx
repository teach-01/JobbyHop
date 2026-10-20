import React, { useState } from 'react';
import { Star, MapPin, Award, CheckCircle, Clock } from 'lucide-react';
import { resolveAssetUrl } from '../../utils/assetUrl';

export const WorkerCard = ({ workerProfile, onSelect, selected = false, showAssignBtn = false, onAssign }) => {
  const [imgError, setImgError] = useState(false);
  if (!workerProfile) return null;

  const photoUrl = resolveAssetUrl(workerProfile.profilePhoto);
  const initials = (workerProfile.fullName || 'W')[0].toUpperCase();

  return (
    <div
      className={`p-5 rounded-2xl glass-card border transition-all duration-200 ${
        selected ? 'border-brand-500 bg-brand-950/20' : 'border-slate-800'
      }`}
    >
      <div className="flex items-start gap-4">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={workerProfile.fullName}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-500/40 shrink-0"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border-2 border-brand-500/40 flex items-center justify-center text-brand-400 font-bold text-xl shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white truncate">{workerProfile.fullName}</h4>
            {workerProfile.rating != null && workerProfile.rating >= 1 && workerProfile.rating <= 5 && (
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{workerProfile.rating}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5 text-rose-400" /> {workerProfile.location}
          </p>

          {/* Skills Badges */}
          <div className="flex flex-wrap gap-1 mt-3">
            {workerProfile.skills?.slice(0, 3).map((skill, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 text-[10px] font-medium border border-brand-500/20">
                {skill}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-purple-400" /> {workerProfile.totalAssignments || 0} Events</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-400" /> {workerProfile.availability?.isAvailable ? 'Available' : 'Busy'}</span>
            </div>

            {showAssignBtn && onAssign && (
              <button
                onClick={() => onAssign(workerProfile)}
                className="gradient-btn px-3 py-1.5 rounded-xl text-xs font-bold"
              >
                Assign Worker
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerCard;
