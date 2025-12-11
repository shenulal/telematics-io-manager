'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Package, Cpu, ArrowRightLeft, Menu, X, Users, Shield, LogOut, ChevronDown, User, Key, ClipboardList, AlertTriangle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, Input, Button } from '@/components/ui';

const mainNavigation = [
  { name: 'Vendors', href: '/vendors', icon: Building2 },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'IO Universal', href: '/io-universal', icon: Cpu },
  { name: 'IO Mappings', href: '/io-mappings', icon: ArrowRightLeft },
];

const adminNavigation = [
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Roles', href: '/roles', icon: Shield },
  { name: 'Audit Logs', href: '/audit-logs', icon: ClipboardList },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, sessionExpired, checkSession, clearSessionExpired } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSessionExpiredModalOpen, setIsSessionExpiredModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Show session expired modal when session expires
  useEffect(() => {
    if (sessionExpired) {
      setIsSessionExpiredModalOpen(true);
    }
  }, [sessionExpired]);

  // Handle navigation with session check
  const handleNavClick = async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const isValid = await checkSession();
    if (isValid) {
      router.push(href);
    }
    // If session is expired, the modal will be shown automatically via the useEffect
  };

  // Handle session expired logout
  const handleSessionExpiredLogout = () => {
    setIsSessionExpiredModalOpen(false);
    clearSessionExpired();
    router.push('/login');
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const openChangePassword = () => {
    setIsUserMenuOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess('');
    setIsChangePasswordOpen(true);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(passwordForm),
      });
      const result = await response.json();

      if (result.success) {
        setPasswordSuccess('Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setIsChangePasswordOpen(false), 1500);
      } else {
        setPasswordError(result.error || 'Failed to change password');
      }
    } catch {
      setPasswordError('Network error. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Check if user has admin role
  const isAdmin = user?.Roles?.some(role => role === 'Administrator') || false;

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center">
              <Cpu className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-gray-100">Telematics IO Manager</span>
            </Link>

            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              {mainNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link key={item.name} href={item.href} onClick={(e) => handleNavClick(e, item.href)}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                    <item.icon className="w-4 h-4 mr-2" />{item.name}
                  </Link>
                );
              })}
              {isAdmin && (
                <>
                  <div className="border-l border-gray-200 dark:border-gray-600 mx-2" />
                  {adminNavigation.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link key={item.name} href={item.href} onClick={(e) => handleNavClick(e, item.href)}
                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          isActive ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}>
                        <item.icon className="w-4 h-4 mr-2" />{item.name}
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* User menu */}
          <div className="hidden sm:flex sm:items-center">
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                <User className="w-5 h-5" />
                <span>{user?.FirstName || user?.Username}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.Username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.Roles?.join(', ')}</p>
                  </div>
                  <button onClick={openChangePassword}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Key className="w-4 h-4" />Change Password
                  </button>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                    <LogOut className="w-4 h-4" />Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-700">
          <div className="pt-2 pb-3 space-y-1">
            {mainNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href} onClick={(e) => { setIsMobileMenuOpen(false); handleNavClick(e, item.href); }}
                  className={`flex items-center px-4 py-2 text-base font-medium ${
                    isActive ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-l-4 border-blue-700' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}>
                  <item.icon className="w-5 h-5 mr-3" />{item.name}
                </Link>
              );
            })}
            {isAdmin && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                {adminNavigation.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link key={item.name} href={item.href} onClick={(e) => { setIsMobileMenuOpen(false); handleNavClick(e, item.href); }}
                      className={`flex items-center px-4 py-2 text-base font-medium ${
                        isActive ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-l-4 border-blue-700' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}>
                      <item.icon className="w-5 h-5 mr-3" />{item.name}
                    </Link>
                  );
                })}
              </>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            <div className="px-4 py-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.Username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.Roles?.join(', ')}</p>
            </div>
            <button onClick={() => { setIsMobileMenuOpen(false); openChangePassword(); }}
              className="w-full flex items-center px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Key className="w-5 h-5 mr-3" />Change Password
            </button>
            <button onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
              <LogOut className="w-5 h-5 mr-3" />Logout
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <Modal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} title="Change Password" size="sm">
        <div className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
              {passwordSuccess}
            </div>
          )}
          <Input
            label="Current Password"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            disabled={isChangingPassword}
          />
          <Input
            label="New Password"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            disabled={isChangingPassword}
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            disabled={isChangingPassword}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsChangePasswordOpen(false)} disabled={isChangingPassword}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Session Expired Modal */}
      <Modal isOpen={isSessionExpiredModalOpen} onClose={handleSessionExpiredLogout} title="Session Expired" size="sm">
        <div className="text-center py-4">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Your session has expired</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            For your security, you have been logged out due to inactivity. Please log in again to continue.
          </p>
          <Button onClick={handleSessionExpiredLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Go to Login
          </Button>
        </div>
      </Modal>
    </nav>
  );
}

