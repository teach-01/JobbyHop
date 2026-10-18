import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Star, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import api from '../../services/api';

export default function AdminRatingModal({ isOpen, onClose, targetUser, targetProfile, currentRating, onRatingUpdated, initialRemoveMode = false }) {
  const [selectedRating, setSelectedRating] = useState(currentRating || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(initialRemoveMode);
  const { showToast } = useNotifications();

  const handleSave = async () => {
    if (selectedRating < 1 || selectedRating > 5) {
      showToast('error', 'Please select a valid rating between 1 and 5.');
      return;
    }

    try {
      setIsLoading(true);
      await api.put(`/admin/users/${targetUser._id}/rating`, { rating: selectedRating });
      showToast('success', 'Rating saved successfully.');
      onRatingUpdated(selectedRating);
      onClose();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to save rating.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setIsLoading(true);
      await api.put(`/admin/users/${targetUser._id}/rating`, { rating: null });
      showToast('success', 'Rating removed successfully.');
      onRatingUpdated(null);
      onClose();
      setIsRemoving(false);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to remove rating.');
      setIsLoading(false);
    }
  };

  if (!isOpen || !targetUser) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) {
          setIsRemoving(false);
          onClose();
        }
      }}
      title={currentRating ? 'Change Rating' : 'Give Rating'}
      maxWidth="max-w-md"
    >
      {!isRemoving ? (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-1">
              {targetProfile?.fullName || targetProfile?.companyName || targetUser?.email}
            </h3>
            <p className="text-sm text-slate-400">
              Select a rating from 1 to 5.
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSelectedRating(star)}
                disabled={isLoading}
                className={`p-2 rounded-xl transition-all ${
                  selectedRating >= star
                    ? 'text-amber-400 scale-110'
                    : 'text-slate-600 hover:text-amber-400/50 hover:scale-105'
                }`}
              >
                <Star className="w-10 h-10" fill={selectedRating >= star ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          <div className="text-center">
            <span className="text-2xl font-black text-amber-400">
              {selectedRating > 0 ? `${selectedRating} / 5` : '- / 5'}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isLoading || selectedRating === 0}
            >
              {isLoading ? 'Saving...' : 'Save Rating'}
            </Button>
          </div>

          {currentRating && (
            <div className="pt-4 border-t border-slate-700 flex justify-center">
              <Button
                variant="danger"
                onClick={() => setIsRemoving(true)}
                disabled={isLoading}
                className="w-full"
              >
                Remove Rating
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Remove Rating?</h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to completely remove this rating?
              The user will be treated as having no rating.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setIsRemoving(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemove}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Removing...' : 'Remove Rating'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
