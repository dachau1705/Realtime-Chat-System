import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { useGetPageCategories, createPageApi } from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';

interface Category {
  id: string;
  name: string;
  description: string;
}

export default function PageCreationWizard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token, showToast } = useChat();

  const categories = useGetPageCategories({ enabled: !!token }) as any as Category[];
  const loadingCategories = categories.length === 0;
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4; // Logical stages combining the 9 validation checkpoints

  // Form Fields State
  const [pageName, setPageName] = useState('');
  const [username, setUsername] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [avatar, setAvatar] = useState('');
  const [coverPhoto, setCoverPhoto] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (categories && categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 1) {
      if (!pageName.trim() || pageName.trim().length < 3) {
        showToast(t('friends.addFriend') || 'Validation Error', 'Page name must be at least 3 characters.', true);
        return;
      }
      if (!username.trim() || username.trim().length < 3) {
        showToast(t('friends.addFriend') || 'Validation Error', 'Username handle must be at least 3 characters.', true);
        return;
      }
      if (!categoryId) {
        showToast(t('friends.addFriend') || 'Validation Error', 'Please select a page category.', true);
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      pageName: pageName.trim(),
      username: username.trim().toLowerCase().replace(/\s+/g, '.'),
      categoryId,
      description: description.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      location: locationAddress.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      avatar: avatar.trim() || null,
      coverPhoto: coverPhoto.trim() || null
    };

    try {
      const res = await createPageApi(payload);

      if (res.data && res.data.status !== false) {
        showToast(t('pages.success'), t('pages.successDesc'), false);
        navigate(`/pages/${res.data.id}`);
      } else {
        showToast(t('pages.fail'), res.data.mess || 'Check fields and try again.', true);
      }
    } catch (err: any) {
      showToast(t('pages.networkError'), err.message || 'Failed to submit form.', true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="profile-container" style={{ display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}>
      <div className="profile-card advanced-layout" style={{ maxWidth: '640px', width: '100%', minHeight: 'auto', height: 'auto', padding: '32px', margin: '0 auto', gap: '20px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{t('pages.createWizardTitle')}</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('pages.createWizardDesc')}</p>
          </div>
          <button className="profile-back-btn" style={{ position: 'static' }} onClick={() => navigate('/')}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flexGrow: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(currentStep / totalSteps) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
            {t('pages.stepOf').replace('{current}', String(currentStep)).replace('{total}', String(totalSteps))}
          </span>
        </div>

        <form onSubmit={currentStep === totalSteps ? handleSubmit : handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Step 1: Page Identity */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.pageNameReq')}</label>
                <input
                  type="text"
                  placeholder="e.g. Antigravity AI Solutions"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.usernameReq')}</label>
                <input
                  type="text"
                  placeholder="e.g. antigravity.ai"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.categoryReq')}</label>
                {loadingCategories ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('pages.loadingCategories')}</div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} style={{ background: '#0c0f1d' }}>{cat.name} - {cat.description}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.aboutDesc')}</label>
                <textarea
                  placeholder="Describe what your page does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', height: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none', resize: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.contactEmail')}</label>
                <input
                  type="email"
                  placeholder="e.g. contact@antigravity.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.phoneNumber')}</label>
                <input
                  type="tel"
                  placeholder="e.g. +1 555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.websiteUrl')}</label>
                <input
                  type="url"
                  placeholder="e.g. https://antigravity.ai"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Branding Assets */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.avatarUrl')}</label>
                <input
                  type="url"
                  placeholder="Paste profile image link..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.coverUrl')}</label>
                <input
                  type="url"
                  placeholder="Paste background banner link..."
                  value={coverPhoto}
                  onChange={(e) => setCoverPhoto(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Location & Coordinate Finalization */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.physicalAddress')}</label>
                <input
                  type="text"
                  placeholder="e.g. 100 Main St, San Francisco, CA"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.latitude')}</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 37.774929"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.longitude')}</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. -122.419416"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--panel-border)', paddingTop: '16px', marginTop: '10px' }}>
            {currentStep > 1 ? (
              <button
                type="button"
                className="edit-profile-btn primary-btn"
                onClick={handleBack}
                style={{ width: 'auto', padding: '10px 24px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)' }}
              >
                {t('pages.back')}
              </button>
            ) : (
              <div />
            )}

            {currentStep < totalSteps ? (
              <button
                type="submit"
                className="primary-btn"
                style={{ width: 'auto', padding: '10px 24px', borderRadius: '10px' }}
              >
                {t('pages.next')}
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="primary-btn"
                style={{ width: 'auto', padding: '10px 24px', borderRadius: '10px' }}
              >
                {submitting ? <i className="fa-solid fa-spinner fa-spin" /> : t('pages.createPageBtn')}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
