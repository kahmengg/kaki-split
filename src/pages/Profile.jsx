import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from '../components/ThemeToggle'
import { removeAvatar, saveProfile, uploadAvatar } from '../lib/kakiSplitApi'

function normalizeSingaporePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('65') && digits.length > 8) {
    return digits.slice(2)
  }
  return digits
}

export default function Profile() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const showToast = useToast()
  const { user, profile, refreshProfile, signOut } = useAuth()

  const [name, setName] = useState('')
  const [paynow, setPaynow] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!profile) return
    setName(profile.display_name || '')
    const oauthPhone = user?.phone || user?.user_metadata?.phone_number || user?.user_metadata?.phone || ''
    setPaynow(normalizeSingaporePhone(profile.paynow_number || oauthPhone))
    setAvatarUrl(profile.avatar_url || '')
  }, [profile, user?.phone])

  const profileUser = useMemo(
    () => ({
      ...(profile || {}),
      id: user?.id,
      name: name || profile?.display_name || user?.email,
      display_name: name || profile?.display_name || user?.email,
      avatar_url: avatarUrl || profile?.avatar_url,
    }),
    [avatarUrl, name, profile, user?.email, user?.id]
  )

  const handleSave = async () => {
    if (!user?.id) return

    setSaving(true)
    try {
        const normalizedPaynow = normalizeSingaporePhone(paynow)

        await saveProfile({
          userId: user.id,
          profile: {
            display_name: name.trim() || user.email?.split('@')[0] || 'User',
            paynow_number: normalizedPaynow || null,
            avatar_url: avatarUrl || null,
          },
        })

      await refreshProfile()
      showToast('Saved!', 'success')
    } catch (error) {
      showToast(error.message || 'Unable to save profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarPick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (!user?.id) return

    setUploading(true)
    try {
      const publicUrl = await uploadAvatar({ userId: user.id, file })
      setAvatarUrl(publicUrl)
      showToast('Photo uploaded', 'success')
    } catch (error) {
      showToast(error.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user?.id || !avatarUrl) return

    setRemovingAvatar(true)
    try {
      await removeAvatar({ avatarUrl })
      setAvatarUrl('')
      await saveProfile({
        userId: user.id,
        profile: {
          avatar_url: null,
        },
      })
      await refreshProfile()
      showToast('Profile photo removed', 'success')
    } catch (error) {
      showToast(error.message || 'Unable to remove profile photo', 'error')
    } finally {
      setRemovingAvatar(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      showToast(error.message || 'Unable to sign out', 'error')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
        <div className="bg-white px-5 pt-12 pb-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black text-gray-900">Profile</h1>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-4">

          <div className="relative">
            <Avatar user={profileUser} size="xl" />
            <button onClick={handleAvatarPick} className="absolute -bottom-1 -right-1 w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center border-2 border-white">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{name || profile?.display_name || 'User'}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={handleAvatarPick}
                  disabled={uploading || removingAvatar}
                  className="text-xs font-semibold text-sky-600 disabled:opacity-60"
                >
                  {uploading ? 'Uploading...' : 'Edit photo'}
                </button>
                {avatarUrl ? (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploading || removingAvatar}
                    className="text-xs font-semibold text-red-500 disabled:opacity-60"
                  >
                    {removingAvatar ? 'Removing...' : 'Remove photo'}
                  </button>
                ) : null}
              </div>

          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Account</p>
          </div>

          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Display name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Email</label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-1">Email cannot be changed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment methods</p>
            <p className="text-xs text-gray-400 mt-0.5">Let others pay you with any Singapore banking app.</p>
          </div>

          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1.5">
                <span className="w-5 h-5 bg-red-50 rounded-lg flex items-center justify-center text-sm">&#128241;</span>
                PayNow number
              </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={8}
                  value={paynow}
                  onChange={(event) => setPaynow(normalizeSingaporePhone(event.target.value).slice(0, 8))}
                  placeholder="91234567"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1 ml-1">Enter 8-digit Singapore mobile number</p>

            </div>

          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full py-4 rounded-full font-bold text-base transition-all bg-sky-500 text-white disabled:opacity-60"
          style={{ boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)' }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full px-4 py-4 flex items-center gap-3 text-left disabled:opacity-60"
            >
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </div>
              <span className="text-red-500 font-semibold text-sm">{signingOut ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>


        <p className="text-center text-xs text-gray-300 pb-2">Kaki Split v1.0</p>
      </div>

      <BottomNav onFABPress={() => navigate('/dashboard')} />
    </div>
  )
}
