'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/context/AuthContext';
import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await updateProfile(user, { displayName });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white px-4 py-10">
        <div className="container mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
          
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
            <div className="mb-8 flex items-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold mr-6">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-semibold">{user?.displayName || 'User'}</h2>
                <p className="text-gray-400">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={user?.email || ''}
                  disabled
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>

              <Button 
                className="w-full mt-6" 
                onClick={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </Button>
            </div>
          </div>

          <div className="mt-10 bg-gray-800 rounded-xl p-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-6">Account Settings</h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Change Password</h3>
                  <p className="text-sm text-gray-400">Update your password</p>
                </div>
                <Button variant="outline" className="border-gray-700">
                  Change
                </Button>
              </div>
              
              <div className="border-t border-gray-700 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-red-500">Delete Account</h3>
                    <p className="text-sm text-gray-400">Permanently delete your account and all data</p>
                  </div>
                  <Button variant="outline" className="border-red-800 text-red-500 hover:bg-red-950">
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 