import React, { useState } from 'react';
import { searchLocations, searchLanguages, acceptFamilyRequest, getData } from '../../services/api';

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  created_at: string;
  privacy_is_public: boolean;
  is_redacted?: boolean;
  location?: string | null;
  hometown?: string | null;
  birthday?: string | null;
  relationship_status?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  languages?: string | null;
  category?: string | null;
  pronunciation?: string | null;
  other_names?: string | null;
  copyright_statement?: string | null;
  work?: Array<{ id?: string; company: string; position: string; description?: string | null; duration?: string | null; privacy_level?: string }>;
  education?: Array<{ id?: string; school_name: string; degree: string; description?: string | null; privacy_level?: string }>;
  hobbies?: string[];
  places_visited?: string[];
  favorite_groups?: Array<{ id?: string; group_name: string; members_count?: string | null; icon?: string | null; privacy_level?: string }>;
  social_links?: Array<{ id?: string; platform: string; url: string; privacy_level?: string }>;
  offers?: Array<{ id?: string; title: string; description?: string | null; link?: string | null; privacy_level?: string }>;
  privacy_settings?: any;
  family_members?: any[];
}

interface AboutTabCardProps {
  profile: UserProfile;
  formattedDate: string;
  t: (key: string) => string;
  isOwner: boolean;
  onUpdateProfile: (updatedData: any) => Promise<void>;
  currentUser: any;
}

type SubTab =
  | 'overview'
  | 'category'
  | 'personal'
  | 'links'
  | 'community'
  | 'offers'
  | 'work'
  | 'education'
  | 'hobbies'
  | 'interests'
  | 'travel'
  | 'contact'
  | 'privacy'
  | 'names';

export const AboutTabCard: React.FC<AboutTabCardProps> = ({ profile, formattedDate, t, isOwner, onUpdateProfile, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [editPrivacy, setEditPrivacy] = useState<string>('public');

  // Autocomplete suggestion states
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [languageSuggestions, setLanguageSuggestions] = useState<any[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [langInput, setLangInput] = useState<string>('');

  const subTabsList: { key: SubTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Giới thiệu', icon: 'fa-solid fa-house-user' },
    { key: 'category', label: 'Hạng mục', icon: 'fa-solid fa-tags' },
    { key: 'personal', label: 'Thông tin cá nhân', icon: 'fa-solid fa-address-card' },
    { key: 'links', label: 'Liên kết', icon: 'fa-solid fa-link' },
    { key: 'community', label: 'Cộng đồng', icon: 'fa-solid fa-users' },
    { key: 'offers', label: 'Ưu đãi', icon: 'fa-solid fa-gift' },
    { key: 'work', label: 'Công việc', icon: 'fa-solid fa-briefcase' },
    { key: 'education', label: 'Trình độ học vấn', icon: 'fa-solid fa-graduation-cap' },
    { key: 'hobbies', label: 'Sở thích', icon: 'fa-solid fa-heart' },
    { key: 'interests', label: 'Mối quan tâm', icon: 'fa-solid fa-compass' },
    { key: 'travel', label: 'Du lịch', icon: 'fa-solid fa-plane' },
    { key: 'contact', label: 'Thông tin liên hệ', icon: 'fa-solid fa-phone' },
    { key: 'privacy', label: 'Pháp lý & Quyền riêng tư', icon: 'fa-solid fa-shield-halved' },
    { key: 'names', label: 'Tên', icon: 'fa-solid fa-signature' },
  ];

  const getPrivacyIcon = (priv: string) => {
    switch (priv) {
      case 'friends': return 'fa-solid fa-user-group';
      case 'private': return 'fa-solid fa-lock';
      case 'public':
      default: return 'fa-solid fa-earth-americas';
    }
  };

  const getPrivacyLabel = (priv: string) => {
    switch (priv) {
      case 'friends': return 'Bạn bè';
      case 'private': return 'Chỉ mình tôi';
      case 'public':
      default: return 'Công khai';
    }
  };

  // Fallbacks for profile display
  const getVal = (field: keyof UserProfile, fallback: any) => {
    return profile[field] !== undefined && profile[field] !== null ? profile[field] : fallback;
  };

  const getPersonalVal = (field: string, fallback: string) => {
    return (profile as any)[field] !== undefined && (profile as any)[field] !== null ? (profile as any)[field] : fallback;
  };

  const getFieldPrivacy = (fieldKey: string) => {
    return (profile.privacy_settings?.[fieldKey]) || 'public';
  };

  const parseBirthday = (str: string | null) => {
    try {
      if (str && str.trim().startsWith('{')) {
        return JSON.parse(str);
      }
    } catch (err) {
      // ignore
    }
    return { day: 12, month: 10, year: 1995, hide_year: true };
  };

  const renderBirthdayDisplay = (val: string | null) => {
    if (!val) return 'Chưa cung cấp';
    const bd = parseBirthday(val);
    if (bd.hide_year) {
      return `Ngày ${bd.day} tháng ${bd.month}`;
    }
    return `Ngày ${bd.day} tháng ${bd.month}, năm ${bd.year}`;
  };

  const handleLocationSearch = async (val: string) => {
    if (!val) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const results = await searchLocations('', val);
      setLocationSuggestions(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLanguageSearch = async (val: string) => {
    if (!val.trim()) {
      setLanguageSuggestions([]);
      return;
    }
    try {
      const results = await searchLanguages('', val.trim());
      setLanguageSuggestions(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserSearch = async (val: string) => {
    if (!val) {
      setUserSuggestions([]);
      return;
    }
    try {
      const res: any = await getData(`/search/users?q=${val}`);
      setUserSuggestions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveField = async (fieldKey: string, newValue: any, newPrivacy?: string) => {
    const currentPrivacy = profile.privacy_settings || {};
    const updatedPrivacy = { ...currentPrivacy };
    if (newPrivacy) {
      updatedPrivacy[fieldKey] = newPrivacy;
    }

    const payload: any = {
      category: getVal('category', 'Người sáng tạo nội dung số (Digital Creator)'),
      pronunciation: getVal('pronunciation', ''),
      other_names: getVal('other_names', ''),
      copyright_statement: getVal('copyright_statement', ''),
      privacy_settings: updatedPrivacy,
      personal_info: {
        location: getPersonalVal('location', 'Quận 1, Thành phố Hồ Chí Minh, Việt Nam'),
        hometown: getPersonalVal('hometown', 'Hà Nội, Việt Nam'),
        birthday: getPersonalVal('birthday', '12 tháng 10'),
        relationship_status: getPersonalVal('relationship_status', 'Độc thân'),
        gender: getPersonalVal('gender', 'Nam'),
        pronouns: getPersonalVal('pronouns', 'anh ấy'),
        languages: getPersonalVal('languages', 'Tiếng Việt (Bản xứ), Tiếng Anh (Giao tiếp tốt)'),
        interests_music: getPersonalVal('interests_music', 'Pop, Rock, Lofi chill, Sơn Tùng M-TP, Vũ.'),
        interests_tv: getPersonalVal('interests_tv', 'Shark Tank Việt Nam, 2 Ngày 1 Đêm, Running Man.'),
        interests_movies: getPersonalVal('interests_movies', 'Interstellar, Inception, Avengers.'),
        interests_games: getPersonalVal('interests_games', 'League of Legends, Valorant, Cyberpunk 2077.'),
        interests_sports: getPersonalVal('interests_sports', 'Lionel Messi / Cristiano Ronaldo / Manchester United FC'),
        website: getPersonalVal('website', 'https://connectly.dev'),
        blog: getPersonalVal('blog', 'https://blog.connectly.dev'),
        other_profiles: getPersonalVal('other_profiles', '')
      },
      work: getVal('work', []),
      education: getVal('education', []),
      hobbies: getVal('hobbies', ['Lập trình', 'Nhiếp ảnh', 'Du lịch bụi', 'Nghe nhạc', 'Chơi game', 'Nấu ăn']),
      places_visited: getVal('places_visited', ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Nha Trang', 'Đà Lạt', 'Sa Pa', 'Phú Quốc', 'Tokyo', 'Bangkok']),
      favorite_groups: getVal('favorite_groups', []),
      social_links: getVal('social_links', []),
      offers: getVal('offers', []),
      family_members: getVal('family_members', [])
    };

    // Apply granular updates to constructed payload
    if (fieldKey.startsWith('personal_info.')) {
      const subKey = fieldKey.split('.')[1];
      payload.personal_info[subKey] = newValue;
    } else if (fieldKey === 'category' || fieldKey === 'pronunciation' || fieldKey === 'other_names' || fieldKey === 'copyright_statement') {
      payload[fieldKey] = newValue;
    } else if (fieldKey === 'work' || fieldKey === 'education' || fieldKey === 'favorite_groups' || fieldKey === 'social_links' || fieldKey === 'offers' || fieldKey === 'family_members') {
      payload[fieldKey] = newValue;
    } else if (fieldKey === 'hobbies' || fieldKey === 'places_visited') {
      payload[fieldKey] = typeof newValue === 'string' ? newValue.split(',').map((s: string) => s.trim()).filter(Boolean) : newValue;
    } else if (fieldKey === 'phone') {
      payload.phone = newValue;
    } else if (fieldKey === 'email') {
      payload.email = newValue;
    }

    console.log("[DEBUG FRONTEND] handleSaveField triggered. fieldKey:", fieldKey, "newValue:", newValue, "newPrivacy:", newPrivacy);
    console.log("[DEBUG FRONTEND] Constructed payload for update:", payload);

    try {
      await onUpdateProfile(payload);
      console.log("[DEBUG FRONTEND] handleSaveField successfully updated profile!");
      setEditingField(null);
    } catch (err) {
      console.error("[DEBUG FRONTEND] handleSaveField failed with error:", err);
      // toast error handled by parent
    }
  };

  const handleConfirmFamilyRequest = async (requestId: string) => {
    try {
      await acceptFamilyRequest('', requestId);
      alert('Đã xác nhận là thành viên gia đình!');
      window.location.reload();
    } catch (err) {
      alert('Không thể xác nhận yêu cầu kết nối.');
    }
  };

  const startEditField = (fieldKey: string, currentValue: any) => {
    setEditingField(fieldKey);
    if (fieldKey === 'personal_info.birthday') {
      setEditValue(parseBirthday(currentValue));
    } else if (fieldKey === 'personal_info.languages') {
      const list = currentValue ? currentValue.split(',').map((l: string) => l.trim()).filter(Boolean) : [];
      setEditValue(list);
      setLangInput('');
    } else {
      setEditValue(currentValue);
    }
    setEditPrivacy(profile.privacy_settings?.[fieldKey] || 'public');
  };

  const renderEditButtons = (fieldKey: string, currentValue: any) => {
    if (!isOwner) return null;
    return (
      <button
        onClick={() => startEditField(fieldKey, currentValue)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: 'auto'
        }}
      >
        <i className="fa-solid fa-pen" style={{ fontSize: '11px' }} /> Chỉnh sửa
      </button>
    );
  };

  const renderFieldOrForm = (fieldKey: string, label: string, currentValue: any, icon: string, isTextarea = false) => {
    const isEditing = editingField === fieldKey;

    if (isEditing) {
      // 1. Birthday Custom Editor
      if (fieldKey === 'personal_info.birthday') {
        const valObj = editValue || { day: 12, month: 10, year: 1995, hide_year: true };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="about-edit-input"
                style={{ flex: 1 }}
                value={valObj.day}
                onChange={(e) => setEditValue({ ...valObj, day: parseInt(e.target.value) })}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Ngày {d}</option>
                ))}
              </select>
              <select
                className="about-edit-input"
                style={{ flex: 1 }}
                value={valObj.month}
                onChange={(e) => setEditValue({ ...valObj, month: parseInt(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <select
                className="about-edit-input"
                style={{ flex: 1 }}
                value={valObj.year}
                onChange={(e) => setEditValue({ ...valObj, year: parseInt(e.target.value) })}
                disabled={valObj.hide_year}
              >
                {Array.from({ length: 127 }, (_, i) => 2026 - i).map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-main)', marginTop: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={valObj.hide_year}
                onChange={(e) => setEditValue({ ...valObj, hide_year: e.target.checked })}
              />
              Ẩn năm sinh (Không công khai năm sinh)
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                <select
                  className="about-edit-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                >
                  <option value="public">🌐 Công khai</option>
                  <option value="friends">👥 Bạn bè</option>
                  <option value="private">🔒 Chỉ mình tôi</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingField(null)}>Hủy</button>
                <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleSaveField(fieldKey, JSON.stringify(editValue), editPrivacy)}>Lưu</button>
              </div>
            </div>
          </div>
        );
      }

      // 2. Relationship Status dropdown
      if (fieldKey === 'personal_info.relationship_status') {
        const relations = [
          'độc thân', 'đang hẹn hò', 'đã đính hôn', 'đã kết hôn', 
          'chung sống có đăng ký', 'chung sống', 'tìm hiểu', 
          'có mối quan hệ phức tạp', 'đã ly thân', 'đã ly hôn', 'góa'
        ];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
            <select
              className="about-edit-input"
              value={editValue || ''}
              onChange={(e) => setEditValue(e.target.value)}
            >
              <option value="">Chọn trạng thái...</option>
              {relations.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                <select
                  className="about-edit-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                >
                  <option value="public">🌐 Công khai</option>
                  <option value="friends">👥 Bạn bè</option>
                  <option value="private">🔒 Chỉ mình tôi</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingField(null)}>Hủy</button>
                <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleSaveField(fieldKey, editValue, editPrivacy)}>Lưu</button>
              </div>
            </div>
          </div>
        );
      }

      // 3. Gender dropdown
      if (fieldKey === 'personal_info.gender') {
        const genders = ['Nam', 'Nữ', 'Khác'];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
            <select
              className="about-edit-input"
              value={editValue || ''}
              onChange={(e) => setEditValue(e.target.value)}
            >
              <option value="">Chọn giới tính...</option>
              {genders.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                <select
                  className="about-edit-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                >
                  <option value="public">🌐 Công khai</option>
                  <option value="friends">👥 Bạn bè</option>
                  <option value="private">🔒 Chỉ mình tôi</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingField(null)}>Hủy</button>
                <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleSaveField(fieldKey, editValue, editPrivacy)}>Lưu</button>
              </div>
            </div>
          </div>
        );
      }

      // 4. Pronouns dropdown
      if (fieldKey === 'personal_info.pronouns') {
        const pronounsList = ['anh ấy', 'cô ấy', 'họ'];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
            <select
              className="about-edit-input"
              value={editValue || ''}
              onChange={(e) => setEditValue(e.target.value)}
            >
              <option value="">Chọn danh xưng...</option>
              {pronounsList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                <select
                  className="about-edit-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                >
                  <option value="public">🌐 Công khai</option>
                  <option value="friends">👥 Bạn bè</option>
                  <option value="private">🔒 Chỉ mình tôi</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingField(null)}>Hủy</button>
                <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleSaveField(fieldKey, editValue, editPrivacy)}>Lưu</button>
              </div>
            </div>
          </div>
        );
      }

      // 5. Locations & Hometown Autocomplete
      if (fieldKey === 'personal_info.location' || fieldKey === 'personal_info.hometown') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
            <div className="autocomplete-container">
              <input
                type="text"
                className="about-edit-input"
                value={editValue || ''}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  handleLocationSearch(e.target.value);
                }}
                placeholder="Nhập và chọn địa điểm..."
              />
              {locationSuggestions.length > 0 && (
                <div className="autocomplete-suggestions">
                  {locationSuggestions.map(s => (
                    <div
                      key={s.id}
                      className="autocomplete-suggestion-item"
                      onClick={() => {
                        setEditValue(s.name);
                        setLocationSuggestions([]);
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                <select
                  className="about-edit-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                >
                  <option value="public">🌐 Công khai</option>
                  <option value="friends">👥 Bạn bè</option>
                  <option value="private">🔒 Chỉ mình tôi</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { setEditingField(null); setLocationSuggestions([]); }}>Hủy</button>
                <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { handleSaveField(fieldKey, editValue, editPrivacy); setLocationSuggestions([]); }}>Lưu</button>
              </div>
            </div>
          </div>
        );
      }

      // 6. Languages Autocomplete
      if (fieldKey === 'personal_info.languages') {
        const selectedList = editValue || [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
            
            {/* Display list of selected tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
              {selectedList.map((lang: string, idx: number) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 500 }}>
                  {lang}
                  <i
                    className="fa-solid fa-xmark"
                    style={{ cursor: 'pointer', fontSize: '11px', opacity: 0.8 }}
                    onClick={() => {
                      const updated = selectedList.filter((_: any, i: number) => i !== idx);
                      setEditValue(updated);
                    }}
                  />
                </span>
              ))}
              {selectedList.length === 0 && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa chọn ngôn ngữ nào</span>
              )}
            </div>

            <div className="autocomplete-container">
              <input
                type="text"
                className="about-edit-input"
                value={langInput}
                onChange={(e) => {
                  setLangInput(e.target.value);
                  handleLanguageSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (langInput.trim() && !selectedList.includes(langInput.trim())) {
                      setEditValue([...selectedList, langInput.trim()]);
                      setLangInput('');
                      setLanguageSuggestions([]);
                    }
                  }
                }}
                placeholder="Tìm ngôn ngữ hoặc gõ rồi ấn Enter..."
              />
              {languageSuggestions.length > 0 && (
                <div className="autocomplete-suggestions">
                  {languageSuggestions.map(s => (
                    <div
                      key={s.id}
                      className="autocomplete-suggestion-item"
                      onClick={() => {
                        if (!selectedList.includes(s.name)) {
                          setEditValue([...selectedList, s.name]);
                        }
                        setLangInput('');
                        setLanguageSuggestions([]);
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                <select
                  className="about-edit-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                >
                  <option value="public">🌐 Công khai</option>
                  <option value="friends">👥 Bạn bè</option>
                  <option value="private">🔒 Chỉ mình tôi</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { setEditingField(null); setLanguageSuggestions([]); setLangInput(''); }}>Hủy</button>
                <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { handleSaveField(fieldKey, selectedList.join(', '), editPrivacy); setLanguageSuggestions([]); setLangInput(''); }}>Lưu</button>
              </div>
            </div>
          </div>
        );
      }

      // Default editor fallback
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
          {isTextarea ? (
            <textarea
              className="about-edit-textarea"
              value={editValue || ''}
              onChange={(e) => setEditValue(e.target.value)}
            />
          ) : (
            <input
              type="text"
              className="about-edit-input"
              value={editValue || ''}
              onChange={(e) => setEditValue(e.target.value)}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
              <select
                className="about-edit-input"
                style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                value={editPrivacy}
                onChange={(e) => setEditPrivacy(e.target.value)}
              >
                <option value="public">🌐 Công khai</option>
                <option value="friends">👥 Bạn bè</option>
                <option value="private">🔒 Chỉ mình tôi</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="about-edit-btn cancel"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setEditingField(null)}
              >
                Hủy
              </button>
              <button
                className="about-edit-btn save"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => handleSaveField(fieldKey, editValue, editPrivacy)}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      );
    }

    const privacy = getFieldPrivacy(fieldKey);
    const displayValue = fieldKey === 'personal_info.birthday' 
      ? renderBirthdayDisplay(currentValue) 
      : (currentValue || 'Chưa cung cấp');

    return (
      <div className="about-subtab-card" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <div className="about-subtab-card-icon"><i className={icon} /></div>
        <div className="about-subtab-card-info" style={{ flexGrow: 1 }}>
          <span className="about-subtab-card-title">{label}</span>
          <span className="about-subtab-card-desc">{displayValue}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <i className={getPrivacyIcon(privacy)} style={{ fontSize: '10px' }} />
            {getPrivacyLabel(privacy)}
          </span>
        </div>
        {renderEditButtons(fieldKey, currentValue)}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'overview':
        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Tổng quan giới thiệu</h4>
            <div className="about-subtab-card">
              <div className="about-subtab-card-icon"><i className="fa-solid fa-circle-user" /></div>
              <div className="about-subtab-card-info">
                <span className="about-subtab-card-title">{t('profile.fullName') || 'Họ và tên hiển thị'}</span>
                <span className="about-subtab-card-desc">{profile.full_name || 'Chưa cung cấp'}</span>
              </div>
            </div>
            {profile.bio && (
              <div className="about-subtab-card">
                <div className="about-subtab-card-icon"><i className="fa-solid fa-quote-left" /></div>
                <div className="about-subtab-card-info">
                  <span className="about-subtab-card-title">{t('profile.biography') || 'Tiểu sử'}</span>
                  <span className="about-subtab-card-desc">"{profile.bio}"</span>
                </div>
              </div>
            )}
            <div className="about-subtab-card">
              <div className="about-subtab-card-icon"><i className="fa-solid fa-calendar-days" /></div>
              <div className="about-subtab-card-info">
                <span className="about-subtab-card-title">{t('profile.joinedDate') || 'Ngày tham gia hệ thống'}</span>
                <span className="about-subtab-card-desc">{formattedDate}</span>
              </div>
            </div>
            <div className="about-subtab-card">
              <div className="about-subtab-card-icon"><i className="fa-solid fa-briefcase" /></div>
              <div className="about-subtab-card-info">
                <span className="about-subtab-card-title">Công việc hiện tại</span>
                <span className="about-subtab-card-desc">
                  {profile.work && profile.work.length > 0 ? `${profile.work[0].position} tại ${profile.work[0].company}` : 'Lập trình viên tại Connectly Co.'}
                </span>
              </div>
            </div>
          </div>
        );

      case 'category':
        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Hạng mục hồ sơ</h4>
            {renderFieldOrForm(
              'category',
              'Hạng mục tài khoản',
              getVal('category', 'Người sáng tạo nội dung số (Digital Creator)'),
              'fa-solid fa-tags'
            )}
          </div>
        );

      case 'personal': {
        const familyList = profile.family_members || [];

        return (
          <div className="about-subtab-grid" style={{ gap: '16px' }}>
            <h4 className="about-subtab-title">Thông tin cá nhân</h4>
            {renderFieldOrForm('personal_info.location', 'Vị trí hiện tại', getPersonalVal('location', 'Quận 1, Thành phố Hồ Chí Minh, Việt Nam'), 'fa-solid fa-location-dot')}
            {renderFieldOrForm('personal_info.hometown', 'Quê quán', getPersonalVal('hometown', 'Hà Nội, Việt Nam'), 'fa-solid fa-house')}
            {renderFieldOrForm('personal_info.birthday', 'Sinh nhật', getPersonalVal('birthday', '12 tháng 10'), 'fa-solid fa-cake-candles')}
            {renderFieldOrForm('personal_info.relationship_status', 'Trạng thái tình cảm / Mối quan hệ', getPersonalVal('relationship_status', 'độc thân'), 'fa-solid fa-heart')}
            {renderFieldOrForm('personal_info.gender', 'Giới tính', getPersonalVal('gender', 'Nam'), 'fa-solid fa-venus-mars')}
            {renderFieldOrForm('personal_info.pronouns', 'Danh xưng ưa thích', getPersonalVal('pronouns', 'anh ấy'), 'fa-solid fa-comments')}
            {renderFieldOrForm('personal_info.languages', 'Ngôn ngữ', getPersonalVal('languages', 'Tiếng Việt (Bản xứ), Tiếng Anh (Giao tiếp tốt)'), 'fa-solid fa-language')}

            {/* Gia đình và Thú cưng Segment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--panel-border)', paddingTop: '16px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>Thành viên gia đình & Thú cưng</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quản lý mối quan hệ thân thiết và thú cưng của bạn.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                {familyList.map((item: any, idx: number) => {
                  const isOwnerRequester = item.requester_id === profile.id || !item.requester_id;
                  const relName = isOwnerRequester 
                    ? (item.relative_full_name || item.relative_username || item.pet_name) 
                    : (item.requester_full_name || item.requester_username);
                  const relAvatar = isOwnerRequester ? item.relative_avatar_url : item.requester_avatar_url;
                  const relUsername = isOwnerRequester ? item.relative_username : item.requester_username;

                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '12px 16px', width: '100%' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', overflow: 'hidden' }}>
                        {item.member_type === 'pet' ? '🐶' : (
                          relAvatar ? <img src={relAvatar} alt={relName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {relName} {relUsername && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>@{relUsername}</span>}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {item.relationship} • {item.status === 'accepted' ? (
                            <span style={{ color: '#10B981', fontWeight: 600 }}><i className="fa-solid fa-circle-check" /> Đã xác nhận</span>
                          ) : (
                            <span style={{ color: '#F59E0B', fontWeight: 600 }}><i className="fa-solid fa-clock" /> Chờ xác nhận</span>
                          )}
                        </span>
                      </div>

                      {/* Accept request button for B relative */}
                      {item.status === 'pending' && item.relative_user_id === currentUser?.id && (
                        <button
                          onClick={() => handleConfirmFamilyRequest(item.id)}
                          style={{
                            marginLeft: 'auto',
                            padding: '6px 12px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            fontWeight: 600
                          }}
                        >
                          Xác nhận
                        </button>
                      )}

                      {/* Delete relation for owners */}
                      {isOwner && (
                        <button
                          onClick={() => {
                            const updated = [...familyList];
                            updated.splice(idx, 1);
                            handleSaveField('family_members', updated);
                          }}
                          style={{
                            marginLeft: item.status === 'pending' && item.relative_user_id === currentUser?.id ? '8px' : 'auto',
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add new family request form */}
                {isOwner && editingField === 'family_new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select
                        className="about-edit-input"
                        style={{ flex: 1 }}
                        value={editValue.member_type || 'member'}
                        onChange={(e) => setEditValue({ ...editValue, member_type: e.target.value, relative_user_id: '', pet_name: '', userQuery: '' })}
                      >
                        <option value="member">Thành viên</option>
                        <option value="pet">Thú cưng</option>
                      </select>

                      <input
                        type="text"
                        className="about-edit-input"
                        style={{ flex: 1 }}
                        placeholder="Quan hệ (Bố, Mẹ, Vợ, Chồng, Con...)"
                        value={editValue.relationship || ''}
                        onChange={(e) => setEditValue({ ...editValue, relationship: e.target.value })}
                      />
                    </div>

                    {editValue.member_type === 'pet' ? (
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Tên thú cưng..."
                        value={editValue.pet_name || ''}
                        onChange={(e) => setEditValue({ ...editValue, pet_name: e.target.value })}
                      />
                    ) : (
                      <div className="autocomplete-container">
                        <input
                          type="text"
                          className="about-edit-input"
                          placeholder="Tìm người thân theo tên, email..."
                          value={editValue.userQuery || ''}
                          onChange={(e) => {
                            setEditValue({ ...editValue, userQuery: e.target.value });
                            handleUserSearch(e.target.value);
                          }}
                        />
                        {userSuggestions.length > 0 && (
                          <div className="autocomplete-suggestions">
                            {userSuggestions.map(u => (
                              <div
                                key={u.id}
                                className="autocomplete-suggestion-item"
                                onClick={() => {
                                  setEditValue({ 
                                    ...editValue, 
                                    relative_user_id: u.id, 
                                    userQuery: u.full_name || u.username 
                                  });
                                  setUserSuggestions([]);
                                }}
                              >
                                {u.full_name || u.username} (@{u.username})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button className="about-edit-btn cancel" onClick={() => { setEditingField(null); setUserSuggestions([]); }}>Hủy</button>
                      <button 
                        className="about-edit-btn save" 
                        onClick={() => {
                          const updated = [...familyList];
                          updated.push({
                            member_type: editValue.member_type,
                            pet_name: editValue.pet_name,
                            relative_user_id: editValue.relative_user_id,
                            relationship: editValue.relationship,
                            status: editValue.member_type === 'pet' ? 'accepted' : 'pending'
                          });
                          handleSaveField('family_members', updated);
                          setUserSuggestions([]);
                        }}
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                )}

                {isOwner && editingField !== 'family_new' && (
                  <button
                    type="button"
                    style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '12px', cursor: 'pointer', width: 'fit-content', fontWeight: 600, fontSize: '12.5px', marginTop: '6px' }}
                    onClick={() => {
                      setEditingField('family_new');
                      setEditValue({ member_type: 'member', relationship: 'Thành viên gia đình', pet_name: '', relative_user_id: '', userQuery: '' });
                    }}
                  >
                    + Thêm thành viên / thú cưng
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'links':
        return (
          <div className="about-subtab-grid" style={{ gap: '16px' }}>
            <h4 className="about-subtab-title">Liên kết</h4>
            {renderFieldOrForm('personal_info.website', 'Trang web', getPersonalVal('website', 'https://connectly.dev'), 'fa-solid fa-globe')}
            {renderFieldOrForm('personal_info.blog', 'Blog', getPersonalVal('blog', 'https://blog.connectly.dev'), 'fa-solid fa-rss')}
            {renderFieldOrForm('personal_info.other_profiles', 'Hồ sơ liên kết khác', getPersonalVal('other_profiles', `GitHub: github.com/${profile.username} / LinkedIn: linkedin.com/in/${profile.username}`), 'fa-solid fa-address-card')}
          </div>
        );

      case 'community': {
        const groups = getVal('favorite_groups', [
          { group_name: 'Cộng đồng Javascript Việt Nam', members_count: '85K thành viên', icon: '🟨', privacy_level: 'public' },
          { group_name: 'Cộng đồng ReactJS & Next.js', members_count: '42K thành viên', icon: '⚛️', privacy_level: 'public' },
          { group_name: 'UI/UX Vietnam Designers', members_count: '18K thành viên', icon: '🎨', privacy_level: 'public' },
          { group_name: 'Lập trình viên Chill & Code', members_count: '29K thành viên', icon: '☕', privacy_level: 'public' }
        ]);

        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Cộng đồng</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>Nhóm yêu thích</span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Thêm tối đa 10 nhóm bạn yêu thích.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              {groups.map((group: any, idx: number) => {
                const isEditing = editingField === `community_${idx}`;
                if (isEditing) {
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          style={{ width: '50px', textAlign: 'center' }}
                          className="about-edit-input"
                          placeholder="Icon"
                          value={editValue.icon || ''}
                          onChange={(e) => setEditValue({ ...editValue, icon: e.target.value })}
                        />
                        <input
                          type="text"
                          style={{ flexGrow: 2 }}
                          className="about-edit-input"
                          placeholder="Tên nhóm"
                          value={editValue.group_name || ''}
                          onChange={(e) => setEditValue({ ...editValue, group_name: e.target.value })}
                        />
                        <input
                          type="text"
                          style={{ flexGrow: 1 }}
                          className="about-edit-input"
                          placeholder="Số thành viên"
                          value={editValue.members_count || ''}
                          onChange={(e) => setEditValue({ ...editValue, members_count: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                          <select
                            className="about-edit-input"
                            style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                            value={editValue.privacy_level || 'public'}
                            onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                          >
                            <option value="public">🌐 Công khai</option>
                            <option value="friends">👥 Bạn bè</option>
                            <option value="private">🔒 Chỉ mình tôi</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                          <button
                            className="about-edit-btn save"
                            onClick={() => {
                              const updated = [...groups];
                              updated[idx] = editValue;
                              handleSaveField('favorite_groups', updated);
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '14px 16px', width: '100%' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      {group.icon || '👥'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{group.group_name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {group.members_count} • <i className={getPrivacyIcon(group.privacy_level || 'public')} style={{ fontSize: '10px' }} /> {getPrivacyLabel(group.privacy_level || 'public')}
                      </span>
                    </div>
                    {isOwner && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingField(`community_${idx}`);
                            setEditValue({ ...group });
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...groups];
                            updated.splice(idx, 1);
                            handleSaveField('favorite_groups', updated);
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isOwner && editingField === 'community_new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      style={{ width: '50px', textAlign: 'center' }}
                      className="about-edit-input"
                      placeholder="Icon"
                      value={editValue.icon || ''}
                      onChange={(e) => setEditValue({ ...editValue, icon: e.target.value })}
                    />
                    <input
                      type="text"
                      style={{ flexGrow: 2 }}
                      className="about-edit-input"
                      placeholder="Tên nhóm"
                      value={editValue.group_name || ''}
                      onChange={(e) => setEditValue({ ...editValue, group_name: e.target.value })}
                    />
                    <input
                      type="text"
                      style={{ flexGrow: 1 }}
                      className="about-edit-input"
                      placeholder="Số thành viên"
                      value={editValue.members_count || ''}
                      onChange={(e) => setEditValue({ ...editValue, members_count: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                      <select
                        className="about-edit-input"
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                        value={editValue.privacy_level || 'public'}
                        onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                      >
                        <option value="public">🌐 Công khai</option>
                        <option value="friends">👥 Bạn bè</option>
                        <option value="private">🔒 Chỉ mình tôi</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                      <button className="about-edit-btn save" onClick={() => handleSaveField('favorite_groups', [...groups, editValue])}>Lưu</button>
                    </div>
                  </div>
                </div>
              )}

              {isOwner && editingField !== 'community_new' && (
                <button
                  type="button"
                  style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '12px', cursor: 'pointer', width: 'fit-content', fontWeight: 600, fontSize: '12.5px', marginTop: '6px' }}
                  onClick={() => {
                    setEditingField('community_new');
                    setEditValue({ group_name: '', members_count: '', icon: '👥', privacy_level: 'public' });
                  }}
                >
                  + Thêm nhóm yêu thích
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'offers': {
        const offers = getVal('offers', [
          { title: 'Khuyến mãi', description: 'Nhập mã CONNECTLY20 để nhận giảm giá 20% các khóa học lập trình.', privacy_level: 'public' },
          { title: 'Đường link liên kết tiếp thị', description: 'Đăng ký Cloud VPS tại đối tác để nhận ưu đãi', link: 'hostinger.com/hausubasa', privacy_level: 'public' }
        ]);

        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Ưu đãi</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              {offers.map((offer: any, idx: number) => {
                const isEditing = editingField === `offers_${idx}`;
                if (isEditing) {
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Tiêu đề"
                        value={editValue.title || ''}
                        onChange={(e) => setEditValue({ ...editValue, title: e.target.value })}
                      />
                      <textarea
                        className="about-edit-textarea"
                        placeholder="Mô tả"
                        value={editValue.description || ''}
                        onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                      />
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Đường link"
                        value={editValue.link || ''}
                        onChange={(e) => setEditValue({ ...editValue, link: e.target.value })}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                          <select
                            className="about-edit-input"
                            style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                            value={editValue.privacy_level || 'public'}
                            onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                          >
                            <option value="public">🌐 Công khai</option>
                            <option value="friends">👥 Bạn bè</option>
                            <option value="private">🔒 Chỉ mình tôi</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                          <button
                            className="about-edit-btn save"
                            onClick={() => {
                              const updated = [...offers];
                              updated[idx] = editValue;
                              handleSaveField('offers', updated);
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="about-subtab-card" key={idx} style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                    <div className="about-subtab-card-icon"><i className={offer.link ? "fa-solid fa-link" : "fa-solid fa-tags"} /></div>
                    <div className="about-subtab-card-info" style={{ flexGrow: 1 }}>
                      <span className="about-subtab-card-title">{offer.title}</span>
                      <span className="about-subtab-card-desc">
                        {offer.description}
                        {offer.link && (
                          <a href={`https://${offer.link}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', marginLeft: '6px' }}>
                            {offer.link}
                          </a>
                        )}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <i className={getPrivacyIcon(offer.privacy_level || 'public')} style={{ fontSize: '10px' }} />
                        {getPrivacyLabel(offer.privacy_level || 'public')}
                      </span>
                    </div>
                    {isOwner && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingField(`offers_${idx}`);
                            setEditValue({ ...offer });
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...offers];
                            updated.splice(idx, 1);
                            handleSaveField('offers', updated);
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isOwner && editingField === 'offers_new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Tiêu đề"
                    value={editValue.title || ''}
                    onChange={(e) => setEditValue({ ...editValue, title: e.target.value })}
                  />
                  <textarea
                    className="about-edit-textarea"
                    placeholder="Mô tả"
                    value={editValue.description || ''}
                    onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                  />
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Đường link"
                    value={editValue.link || ''}
                    onChange={(e) => setEditValue({ ...editValue, link: e.target.value })}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                      <select
                        className="about-edit-input"
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                        value={editValue.privacy_level || 'public'}
                        onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                      >
                        <option value="public">🌐 Công khai</option>
                        <option value="friends">👥 Bạn bè</option>
                        <option value="private">🔒 Chỉ mình tôi</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                      <button className="about-edit-btn save" onClick={() => handleSaveField('offers', [...offers, editValue])}>Lưu</button>
                    </div>
                  </div>
                </div>
              )}

              {isOwner && editingField !== 'offers_new' && (
                <button
                  type="button"
                  style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '12px', cursor: 'pointer', width: 'fit-content', fontWeight: 600, fontSize: '12.5px', marginTop: '6px' }}
                  onClick={() => {
                    setEditingField('offers_new');
                    setEditValue({ title: '', description: '', link: '', privacy_level: 'public' });
                  }}
                >
                  + Thêm ưu đãi / liên kết tiếp thị
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'work': {
        const jobs = getVal('work', [
          { company: 'S-TECH Corp', position: 'Kỹ sư Web Developer', description: 'Xây dựng hệ thống chat trực tuyến thời gian thực và quản lý nhân sự.', duration: '2024 - Hiện tại', privacy_level: 'public' },
          { company: 'FPT Software', position: 'Fullstack Developer', description: 'Thiết kế API backend và triển khai cơ sở dữ liệu Postgres.', duration: '2021 - 2023', privacy_level: 'public' }
        ]);

        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Công việc</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              {jobs.map((job: any, idx: number) => {
                const isEditing = editingField === `work_${idx}`;
                if (isEditing) {
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Công ty"
                        value={editValue.company || ''}
                        onChange={(e) => setEditValue({ ...editValue, company: e.target.value })}
                      />
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Vị trí"
                        value={editValue.position || ''}
                        onChange={(e) => setEditValue({ ...editValue, position: e.target.value })}
                      />
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Khoảng thời gian"
                        value={editValue.duration || ''}
                        onChange={(e) => setEditValue({ ...editValue, duration: e.target.value })}
                      />
                      <textarea
                        className="about-edit-textarea"
                        placeholder="Mô tả công việc"
                        value={editValue.description || ''}
                        onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                          <select
                            className="about-edit-input"
                            style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                            value={editValue.privacy_level || 'public'}
                            onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                          >
                            <option value="public">🌐 Công khai</option>
                            <option value="friends">👥 Bạn bè</option>
                            <option value="private">🔒 Chỉ mình tôi</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                          <button
                            className="about-edit-btn save"
                            onClick={() => {
                              const updated = [...jobs];
                              updated[idx] = editValue;
                              handleSaveField('work', updated);
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="about-subtab-card" key={idx} style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                    <div className="about-subtab-card-icon"><i className="fa-solid fa-briefcase" /></div>
                    <div className="about-subtab-card-info" style={{ flexGrow: 1 }}>
                      <span className="about-subtab-card-title">{job.position} tại {job.company}</span>
                      <span className="about-subtab-card-desc">{job.description} ({job.duration})</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <i className={getPrivacyIcon(job.privacy_level || 'public')} style={{ fontSize: '10px' }} />
                        {getPrivacyLabel(job.privacy_level || 'public')}
                      </span>
                    </div>
                    {isOwner && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingField(`work_${idx}`);
                            setEditValue({ ...job });
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...jobs];
                            updated.splice(idx, 1);
                            handleSaveField('work', updated);
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isOwner && editingField === 'work_new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Công ty"
                    value={editValue.company || ''}
                    onChange={(e) => setEditValue({ ...editValue, company: e.target.value })}
                  />
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Vị trí"
                    value={editValue.position || ''}
                    onChange={(e) => setEditValue({ ...editValue, position: e.target.value })}
                  />
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Khoảng thời gian"
                    value={editValue.duration || ''}
                    onChange={(e) => setEditValue({ ...editValue, duration: e.target.value })}
                  />
                  <textarea
                    className="about-edit-textarea"
                    placeholder="Mô tả công việc"
                    value={editValue.description || ''}
                    onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                      <select
                        className="about-edit-input"
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                        value={editValue.privacy_level || 'public'}
                        onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                      >
                        <option value="public">🌐 Công khai</option>
                        <option value="friends">👥 Bạn bè</option>
                        <option value="private">🔒 Chỉ mình tôi</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                      <button className="about-edit-btn save" onClick={() => handleSaveField('work', [...jobs, editValue])}>Lưu</button>
                    </div>
                  </div>
                </div>
              )}

              {isOwner && editingField !== 'work_new' && (
                <button
                  type="button"
                  style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '12px', cursor: 'pointer', width: 'fit-content', fontWeight: 600, fontSize: '12.5px', marginTop: '6px' }}
                  onClick={() => {
                    setEditingField('work_new');
                    setEditValue({ company: '', position: '', description: '', duration: '', privacy_level: 'public' });
                  }}
                >
                  + Thêm công việc
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'education': {
        const edus = getVal('education', [
          { school_name: 'Đại học Bách Khoa Hà Nội', degree: 'Đại học', description: 'Kỹ sư CNTT, 2017 - 2021', privacy_level: 'public' },
          { school_name: 'THPT Chuyên Hà Nội - Amsterdam', degree: 'Trường trung học phổ thông', description: 'Lớp chuyên Toán, 2014 - 2017', privacy_level: 'public' },
          { school_name: 'THCS Trưng Vương', degree: 'Trường trung học', description: 'Hà Nội, 2010 - 2014', privacy_level: 'public' }
        ]);

        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Trình độ học vấn</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              {edus.map((edu: any, idx: number) => {
                const isEditing = editingField === `education_${idx}`;
                if (isEditing) {
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Tên trường"
                        value={editValue.school_name || ''}
                        onChange={(e) => setEditValue({ ...editValue, school_name: e.target.value })}
                      />
                      <input
                        type="text"
                        className="about-edit-input"
                        placeholder="Cấp bậc / Bằng cấp"
                        value={editValue.degree || ''}
                        onChange={(e) => setEditValue({ ...editValue, degree: e.target.value })}
                      />
                      <textarea
                        className="about-edit-textarea"
                        placeholder="Chi tiết học tập"
                        value={editValue.description || ''}
                        onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                          <select
                            className="about-edit-input"
                            style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                            value={editValue.privacy_level || 'public'}
                            onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                          >
                            <option value="public">🌐 Công khai</option>
                            <option value="friends">👥 Bạn bè</option>
                            <option value="private">🔒 Chỉ mình tôi</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                          <button
                            className="about-edit-btn save"
                            onClick={() => {
                              const updated = [...edus];
                              updated[idx] = editValue;
                              handleSaveField('education', updated);
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="about-subtab-card" key={idx} style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                    <div className="about-subtab-card-icon"><i className="fa-solid fa-graduation-cap" /></div>
                    <div className="about-subtab-card-info" style={{ flexGrow: 1 }}>
                      <span className="about-subtab-card-title">{edu.degree}: {edu.school_name}</span>
                      <span className="about-subtab-card-desc">{edu.description}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <i className={getPrivacyIcon(edu.privacy_level || 'public')} style={{ fontSize: '10px' }} />
                        {getPrivacyLabel(edu.privacy_level || 'public')}
                      </span>
                    </div>
                    {isOwner && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingField(`education_${idx}`);
                            setEditValue({ ...edu });
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...edus];
                            updated.splice(idx, 1);
                            handleSaveField('education', updated);
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isOwner && editingField === 'education_new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Tên trường học"
                    value={editValue.school_name || ''}
                    onChange={(e) => setEditValue({ ...editValue, school_name: e.target.value })}
                  />
                  <input
                    type="text"
                    className="about-edit-input"
                    placeholder="Cấp bậc / Bằng cấp"
                    value={editValue.degree || ''}
                    onChange={(e) => setEditValue({ ...editValue, degree: e.target.value })}
                  />
                  <textarea
                    className="about-edit-textarea"
                    placeholder="Chi tiết học tập"
                    value={editValue.description || ''}
                    onChange={(e) => setEditValue({ ...editValue, description: e.target.value })}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                      <select
                        className="about-edit-input"
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                        value={editValue.privacy_level || 'public'}
                        onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                      >
                        <option value="public">🌐 Công khai</option>
                        <option value="friends">👥 Bạn bè</option>
                        <option value="private">🔒 Chỉ mình tôi</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                      <button className="about-edit-btn save" onClick={() => handleSaveField('education', [...edus, editValue])}>Lưu</button>
                    </div>
                  </div>
                </div>
              )}

              {isOwner && editingField !== 'education_new' && (
                <button
                  type="button"
                  style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '12px', cursor: 'pointer', width: 'fit-content', fontWeight: 600, fontSize: '12.5px', marginTop: '6px' }}
                  onClick={() => {
                    setEditingField('education_new');
                    setEditValue({ school_name: '', degree: '', description: '', privacy_level: 'public' });
                  }}
                >
                  + Thêm cấp học
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'hobbies': {
        const hobbies = getVal('hobbies', ['Lập trình', 'Nhiếp ảnh', 'Du lịch bụi', 'Nghe nhạc', 'Chơi game', 'Nấu ăn']);
        const isEditing = editingField === 'hobbies';

        if (isEditing) {
          return (
            <div className="about-subtab-grid">
              <h4 className="about-subtab-title">Sở thích</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Sở thích (phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  className="about-edit-input"
                  value={editValue || ''}
                  onChange={(e) => setEditValue(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                    <select
                      className="about-edit-input"
                      style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                      value={editPrivacy}
                      onChange={(e) => setEditPrivacy(e.target.value)}
                    >
                      <option value="public">🌐 Công khai</option>
                      <option value="friends">👥 Bạn bè</option>
                      <option value="private">🔒 Chỉ mình tôi</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingField(null)}>Hủy</button>
                    <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleSaveField('hobbies', editValue, editPrivacy)}>Lưu</button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const privacy = getFieldPrivacy('hobbies');

        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Sở thích</h4>
            <div className="about-subtab-card" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
              <div className="about-subtab-card-icon"><i className="fa-solid fa-heart" style={{ color: '#EF4444' }} /></div>
              <div className="about-subtab-card-info" style={{ flexGrow: 1 }}>
                <span className="about-subtab-card-title">Sở thích cá nhân</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {hobbies.map((hobby: string, idx: number) => (
                    <span key={idx} style={{ fontSize: '12.5px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'var(--text-main)', fontWeight: 500 }}>
                      {hobby}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <i className={getPrivacyIcon(privacy)} style={{ fontSize: '10px' }} />
                  {getPrivacyLabel(privacy)}
                </span>
              </div>
              {renderEditButtons('hobbies', hobbies.join(', '))}
            </div>
          </div>
        );
      }

      case 'interests':
        return (
          <div className="about-subtab-grid" style={{ gap: '16px' }}>
            <h4 className="about-subtab-title">Mối quan tâm</h4>
            {renderFieldOrForm('personal_info.interests_music', 'Âm nhạc', getPersonalVal('interests_music', 'Pop, Rock, Lofi chill, Sơn Tùng M-TP, Vũ.'), 'fa-solid fa-music')}
            {renderFieldOrForm('personal_info.interests_tv', 'Chương trình TV', getPersonalVal('interests_tv', 'Shark Tank Việt Nam, 2 Ngày 1 Đêm, Running Man.'), 'fa-solid fa-tv')}
            {renderFieldOrForm('personal_info.interests_movies', 'Phim', getPersonalVal('interests_movies', 'Interstellar, Inception, Avengers.'), 'fa-solid fa-film')}
            {renderFieldOrForm('personal_info.interests_games', 'Game', getPersonalVal('interests_games', 'League of Legends, Valorant, Cyberpunk 2077.'), 'fa-solid fa-gamepad')}
            {renderFieldOrForm('personal_info.interests_sports', 'Vận động viên và đội thể thao', getPersonalVal('interests_sports', 'Lionel Messi / Cristiano Ronaldo / Manchester United FC'), 'fa-solid fa-trophy')}
          </div>
        );

      case 'travel': {
        const places = getVal('places_visited', ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Nha Trang', 'Đà Lạt', 'Sa Pa', 'Phú Quốc', 'Tokyo', 'Bangkok']);
        const isEditing = editingField === 'travel';

        if (isEditing) {
          return (
            <div className="about-subtab-grid">
              <h4 className="about-subtab-title">Du lịch</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--primary)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.02)' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Nơi đã ghé thăm (phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  className="about-edit-input"
                  value={editValue || ''}
                  onChange={(e) => setEditValue(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                    <select
                      className="about-edit-input"
                      style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                      value={editPrivacy}
                      onChange={(e) => setEditPrivacy(e.target.value)}
                    >
                      <option value="public">🌐 Công khai</option>
                      <option value="friends">👥 Bạn bè</option>
                      <option value="private">🔒 Chỉ mình tôi</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="about-edit-btn cancel" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingField(null)}>Hủy</button>
                    <button className="about-edit-btn save" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleSaveField('places_visited', editValue, editPrivacy)}>Lưu</button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const privacy = getFieldPrivacy('travel');

        return (
          <div className="about-subtab-grid">
            <h4 className="about-subtab-title">Du lịch</h4>
            <div className="about-subtab-card" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
              <div className="about-subtab-card-icon"><i className="fa-solid fa-plane" /></div>
              <div className="about-subtab-card-info" style={{ flexGrow: 1 }}>
                <span className="about-subtab-card-title">Địa điểm đã ghé thăm</span>
                <span className="about-subtab-card-desc" style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Đã đi qua {places.length} nơi mà bạn yêu thích.
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {places.map((place: string, idx: number) => (
                    <span key={idx} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-map-pin" style={{ color: '#EF4444', fontSize: '11px' }} />
                      {place}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                  <i className={getPrivacyIcon(privacy)} style={{ fontSize: '10px' }} />
                  {getPrivacyLabel(privacy)}
                </span>
              </div>
              {renderEditButtons('travel', places.join(', '))}
            </div>
          </div>
        );
      }

      case 'contact': {
        const links = getVal('social_links', [{ platform: 'instagram', url: 'hausubasa1705', privacy_level: 'public' }]);

        return (
          <div className="about-subtab-grid" style={{ gap: '24px' }}>
            <h4 className="about-subtab-title">Thông tin liên hệ</h4>

            {/* 1. Mạng xã hội */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>Mạng xã hội</span>
              
              {links.map((link: any, idx: number) => {
                const isEditing = editingField === `contact_social_${idx}`;
                if (isEditing) {
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <select
                          className="about-edit-input"
                          style={{ width: '110px' }}
                          value={editValue.platform || ''}
                          onChange={(e) => setEditValue({ ...editValue, platform: e.target.value })}
                        >
                          <option value="instagram">Instagram</option>
                          <option value="facebook">Facebook</option>
                          <option value="twitter">Twitter</option>
                          <option value="github">GitHub</option>
                          <option value="linkedin">LinkedIn</option>
                        </select>
                        <input
                          type="text"
                          className="about-edit-input"
                          placeholder="Tên tài khoản"
                          value={editValue.url || ''}
                          onChange={(e) => setEditValue({ ...editValue, url: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                          <select
                            className="about-edit-input"
                            style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                            value={editValue.privacy_level || 'public'}
                            onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                          >
                            <option value="public">🌐 Công khai</option>
                            <option value="friends">👥 Bạn bè</option>
                            <option value="private">🔒 Chỉ mình tôi</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                          <button
                            className="about-edit-btn save"
                            onClick={() => {
                              const updated = [...links];
                              updated[idx] = editValue;
                              handleSaveField('social_links', updated);
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '12px 16px', width: '100%' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: link.platform === 'instagram' ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px' }}>
                      <i className={`fa-brands fa-${link.platform}`} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '12px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{link.url}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{link.platform.toUpperCase()} • <i className={getPrivacyIcon(link.privacy_level || 'public')} style={{ fontSize: '10px' }} /> {getPrivacyLabel(link.privacy_level || 'public')}</span>
                    </div>
                    {isOwner && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingField(`contact_social_${idx}`);
                            setEditValue({ ...link });
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...links];
                            updated.splice(idx, 1);
                            handleSaveField('social_links', updated);
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isOwner && editingField === 'contact_social_new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      className="about-edit-input"
                      style={{ width: '110px' }}
                      value={editValue.platform || ''}
                      onChange={(e) => setEditValue({ ...editValue, platform: e.target.value })}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="twitter">Twitter</option>
                      <option value="github">GitHub</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                    <input
                      type="text"
                      className="about-edit-input"
                      placeholder="Tên tài khoản"
                      value={editValue.url || ''}
                      onChange={(e) => setEditValue({ ...editValue, url: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyền riêng tư:</span>
                      <select
                        className="about-edit-input"
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', marginBottom: 0 }}
                        value={editValue.privacy_level || 'public'}
                        onChange={(e) => setEditValue({ ...editValue, privacy_level: e.target.value })}
                      >
                        <option value="public">🌐 Công khai</option>
                        <option value="friends">👥 Bạn bè</option>
                        <option value="private">🔒 Chỉ mình tôi</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="about-edit-btn cancel" onClick={() => setEditingField(null)}>Hủy</button>
                      <button className="about-edit-btn save" onClick={() => handleSaveField('social_links', [...links, editValue])}>Lưu</button>
                    </div>
                  </div>
                </div>
              )}

              {isOwner && editingField !== 'contact_social_new' && (
                <button
                  type="button"
                  style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', width: 'fit-content', fontWeight: 600, fontSize: '12px' }}
                  onClick={() => {
                    setEditingField('contact_social_new');
                    setEditValue({ platform: 'instagram', url: '', privacy_level: 'public' });
                  }}
                >
                  + Thêm liên kết mạng xã hội
                </button>
              )}
            </div>

            {/* 2. Số điện thoại */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>Số điện thoại</span>
              {renderFieldOrForm('phone', 'Di động', profile.phone || '098 614 32 52', 'fa-solid fa-phone')}
            </div>

            {/* 3. Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>Email</span>
              {renderFieldOrForm('email', 'Địa chỉ Email', profile.email || 'hausubasa1705@gmail.com', 'fa-solid fa-envelope')}
            </div>
          </div>
        );
      }

      case 'names':
        return (
          <div className="about-subtab-grid" style={{ gap: '16px' }}>
            <h4 className="about-subtab-title">Chi tiết về tên</h4>
            {renderFieldOrForm('pronunciation', 'Cách đọc tên', getVal('pronunciation', `Phát âm chuẩn: ${profile.full_name || profile.username}`), 'fa-solid fa-volume-high')}
            {renderFieldOrForm('other_names', 'Các tên khác', getVal('other_names', 'Biệt danh: Code Wiz / Tên tiếng Anh: Alex'), 'fa-solid fa-signature')}
          </div>
        );

      case 'privacy':
        return (
          <div className="about-subtab-grid" style={{ gap: '16px' }}>
            <h4 className="about-subtab-title">Thông tin pháp lý & Quyền riêng tư</h4>
            <div className="about-subtab-card">
              <div className="about-subtab-card-icon"><i className="fa-solid fa-shield-halved" /></div>
              <div className="about-subtab-card-info">
                <span className="about-subtab-card-title">Chính sách tài khoản</span>
                <span className="about-subtab-card-desc">
                  Quyền riêng tư hồ sơ: <strong>{profile.privacy_is_public ? 'Công khai' : 'Bạn bè'}</strong>
                </span>
              </div>
            </div>
            {renderFieldOrForm(
              'copyright_statement',
              'Tuyên bố quyền sở hữu và quyền tác giả',
              getVal('copyright_statement', `Bản quyền nội dung và tài sản trí tuệ thuộc về ${profile.full_name || `@${profile.username}`}. Tất cả các quyền được bảo lưu.`),
              'fa-solid fa-copyright',
              true
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="about-tabbed-card">
      <div className="about-tabbed-sidebar">
        {subTabsList.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveSubTab(tab.key);
              setEditingField(null); // clear current active edit
            }}
            className={`about-tabbed-sidebar-item ${activeSubTab === tab.key ? 'active' : ''}`}
          >
            <i className={`${tab.icon}`} style={{ width: '16px', textAlign: 'center' }} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="about-tabbed-content">{renderContent()}</div>
    </div>
  );
};
