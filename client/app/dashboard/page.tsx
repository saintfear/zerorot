'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { userAPI, contentAPI, newsletterAPI } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  preferences: any;
  instagramConnected?: boolean;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    topics: [] as string[],
    style: '',
    keywords: [] as string[],
    likedAccounts: [] as string[],
  });
  const [newTopic, setNewTopic] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newAccount, setNewAccount] = useState('');
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedContent, setSavedContent] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showSavedContent, setShowSavedContent] = useState(false);
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [loadingNewsletters, setLoadingNewsletters] = useState(false);
  const [showNewsletters, setShowNewsletters] = useState(false);
  const [instagramCookiesPaste, setInstagramCookiesPaste] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);
  const [discoverPage, setDiscoverPage] = useState(1);
  const router = useRouter();

  useEffect(() => {
    loadUser();
    loadSavedContent();
    loadNewsletters();
  }, []);

  const loadNewsletters = async () => {
    setLoadingNewsletters(true);
    try {
      const response = await newsletterAPI.getAll();
      setNewsletters(response.data || []);
    } catch (error: any) {
      console.error('Error loading newsletters:', error);
    } finally {
      setLoadingNewsletters(false);
    }
  };

  const loadSavedContent = async () => {
    setLoadingContent(true);
    try {
      const response = await contentAPI.getSaved();
      setSavedContent(response.data || []);
    } catch (error: any) {
      console.error('Error loading saved content:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  const loadUser = async () => {
    try {
      const response = await userAPI.getMe();
      setUser(response.data);
      if (response.data.preferences) {
        // Ensure preferences has the expected structure
        const prefs = response.data.preferences;
        setPreferences({
          topics: Array.isArray(prefs.topics) ? prefs.topics : [],
          style: prefs.style || '',
          keywords: Array.isArray(prefs.keywords) ? prefs.keywords : [],
          likedAccounts: Array.isArray(prefs.likedAccounts) ? prefs.likedAccounts : [],
        });
      } else {
        setPreferences({
          topics: [],
          style: '',
          keywords: [],
          likedAccounts: [],
        });
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await userAPI.updatePreferences(preferences);
      alert('Preferences saved! 🎉');
    } catch (error) {
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discoverRes = await contentAPI.discover(discoverPage);
      const newPosts: any[] = Array.isArray(discoverRes.data?.posts) ? discoverRes.data.posts : [];
      // Fetch saved and merge with discover response in one step so new posts always show
      const savedRes = await contentAPI.getSaved();
      const fromServer: any[] = Array.isArray(savedRes.data) ? savedRes.data : [];
      const byKey = new Map<string, any>();
      const key = (p: any) => String(p?.id ?? p?.instagramId ?? '');
      fromServer.forEach((p: any) => byKey.set(key(p), p));
      newPosts.forEach((p: any) => byKey.set(key(p), p));
      const merged = Array.from(byKey.values()).sort(
        (a: any, b: any) => new Date(b.discoveredAt || 0).getTime() - new Date(a.discoveredAt || 0).getTime()
      );
      setSavedContent(merged);
      setShowSavedContent(true);
      alert(`Found ${newPosts.length} relevant posts! Check your saved content.`);
      setDiscoverPage((prev) => prev + 1);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to discover content');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSendNewsletter = async () => {
    setSending(true);
    try {
      await newsletterAPI.send();
      alert('Newsletter created! Check your newsletters below. 📧');
      // Reload newsletters to show the new one
      await loadNewsletters();
      setShowNewsletters(true);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send newsletter');
    } finally {
      setSending(false);
    }
  };

  const addTopic = () => {
    if (newTopic.trim()) {
      setPreferences({
        ...preferences,
        topics: [...preferences.topics, newTopic.trim()],
      });
      setNewTopic('');
    }
  };

  const removeTopic = (index: number) => {
    setPreferences({
      ...preferences,
      topics: preferences.topics.filter((_, i) => i !== index),
    });
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      setPreferences({
        ...preferences,
        keywords: [...preferences.keywords, newKeyword.trim()],
      });
      setNewKeyword('');
    }
  };

  const removeKeyword = (index: number) => {
    setPreferences({
      ...preferences,
      keywords: preferences.keywords.filter((_, i) => i !== index),
    });
  };

  const addAccount = () => {
    const v = newAccount.trim().replace(/^@/, '');
    if (v && !(preferences.likedAccounts || []).some(a => a.replace(/^@/, '').toLowerCase() === v.toLowerCase())) {
      setPreferences({
        ...preferences,
        likedAccounts: [...(preferences.likedAccounts || []), v],
      });
      setNewAccount('');
    }
  };

  const removeAccount = (index: number) => {
    setPreferences({
      ...preferences,
      likedAccounts: (preferences.likedAccounts || []).filter((_, i) => i !== index),
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const handleSaveInstagramCookies = async () => {
    setSavingCookies(true);
    try {
      await userAPI.updateInstagramCookies(instagramCookiesPaste);
      await loadUser();
      setInstagramCookiesPaste('');
      alert('Instagram session saved! ZeroRot will use it to fetch real posts.');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to save Instagram session';
      alert(msg);
    } finally {
      setSavingCookies(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    setSavingCookies(true);
    try {
      await userAPI.updateInstagramCookies('');
      await loadUser();
      alert('Instagram session cleared.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to disconnect');
    } finally {
      setSavingCookies(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen antique-bg flex items-center justify-center">
        <div className="text-xl text-antique-700 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen antique-bg">
      <nav className="antique-card border-b-2 border-sepia-light shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-typewriter font-bold text-antique-700 tracking-wider">ZeroRot</h1>
            <div className="flex items-center gap-4">
              <span className="text-antique-600 font-mono text-sm">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sepia-dark hover:text-antique-700 font-mono text-sm underline"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-typewriter font-bold text-antique-800 mb-2 tracking-wide">
            Welcome back{user?.name ? `, ${user.name}` : ''}!
          </h2>
          <p className="text-antique-600 font-mono">
            Set your content preferences and let ZeroRot discover amazing Instagram content for you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preferences Card */}
          <div className="antique-card rounded-lg p-6">
            <h3 className="text-xl font-typewriter font-bold text-antique-800 mb-4 tracking-wide">
              Content Preferences
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
                  Topics / Hashtags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                    placeholder="e.g., French cooking, cyberpunk fashion"
                    className="flex-1 px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
                  />
                  <button
                    onClick={addTopic}
                    className="px-4 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-typewriter font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(preferences.topics || []).map((topic, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-sepia-light text-antique-800 rounded-full text-sm font-mono border border-sepia"
                    >
                      {topic}
                      <button
                        onClick={() => removeTopic(index)}
                        className="hover:text-antique-700 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
                  Style (optional)
                </label>
                <input
                  type="text"
                  value={preferences.style}
                  onChange={(e) =>
                    setPreferences({ ...preferences, style: e.target.value })
                  }
                  placeholder="e.g., Fujimoto-style anime, minimalist"
                  className="w-full px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
                  Keywords
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    placeholder="Additional keywords"
                    className="flex-1 px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
                  />
                  <button
                    onClick={addKeyword}
                    className="px-4 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-typewriter font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(preferences.keywords || []).map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-antique-200 text-antique-800 rounded-full text-sm font-mono border border-sepia"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(index)}
                        className="hover:text-antique-700 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-mono font-semibold text-antique-700 mb-2">
                  Accounts you like
                </label>
                <p className="text-xs text-antique-600 font-mono mb-2">
                  We’ll fetch posts from these profiles and use them to refine your taste. Add Instagram usernames (with or without @).
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAccount()}
                    placeholder="e.g. nike, natgeo"
                    className="flex-1 px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono"
                  />
                  <button
                    onClick={addAccount}
                    className="px-4 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-typewriter font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(preferences.likedAccounts || []).map((account, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-800 rounded-full text-sm font-mono border border-green-200"
                    >
                      @{account.replace(/^@/, '')}
                      <button
                        onClick={() => removeAccount(index)}
                        className="hover:text-green-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="w-full bg-sepia hover:bg-sepia-dark text-antique-50 py-2 rounded font-typewriter font-bold tracking-wide transition-colors disabled:opacity-50 shadow-md"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>

          {/* Actions Card */}
          <div className="antique-card rounded-lg p-6">
            <h3 className="text-xl font-typewriter font-bold text-antique-800 mb-4 tracking-wide">
              Actions
            </h3>

            <div className="space-y-4">
              <button
                onClick={handleDiscover}
                disabled={discovering || ((!preferences.topics || preferences.topics.length === 0) && (!preferences.likedAccounts || preferences.likedAccounts.length === 0))}
                className="w-full bg-sepia hover:bg-sepia-dark text-antique-50 py-3 rounded font-typewriter font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {discovering ? 'Discovering...' : 'Discover Content'}
              </button>

              <button
                onClick={handleSendNewsletter}
                disabled={sending || ((!preferences.topics || preferences.topics.length === 0) && (!preferences.likedAccounts || preferences.likedAccounts.length === 0))}
                className="w-full bg-antique-600 hover:bg-antique-700 text-antique-50 py-3 rounded font-typewriter font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {sending ? 'Sending...' : 'Send Test Newsletter'}
              </button>

              <div className="mt-6 p-4 bg-sepia-light border-2 border-sepia rounded-lg">
                <p className="text-sm text-antique-800 font-mono">
                  <strong className="font-typewriter">Tip:</strong> ZeroRot automatically sends you a
                  personalized newsletter every morning at 8:00 AM with the best
                  content matching your preferences!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Connect Instagram — use your login for real posts */}
        <div className="mt-8 antique-card rounded-lg p-6">
          <h3 className="text-xl font-typewriter font-bold text-antique-800 mb-2 tracking-wide">
            Connect Instagram
          </h3>
          <p className="text-antique-600 font-mono text-sm mb-4">
            ZeroRot can use your Instagram session to fetch real posts. Your cookies are stored only on this app and used when you run Discover or newsletters.
          </p>
          {user?.instagramConnected ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <span className="inline-flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded font-mono text-sm border border-green-200">
                ✓ Instagram connected
              </span>
              <button
                onClick={handleDisconnectInstagram}
                disabled={savingCookies}
                className="px-4 py-2 border-2 border-sepia-dark text-antique-700 hover:bg-sepia-light rounded font-mono text-sm transition-colors disabled:opacity-50"
              >
                {savingCookies ? '…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-antique-700 font-mono text-sm">
                <strong>How to get cookies:</strong> Log into instagram.com in Chrome or Brave, then use an extension like &quot;Get cookies.txt LOCALLY&quot; or &quot;cookies.txt&quot; to export in <strong>Netscape format</strong>. Paste the whole contents below.
              </p>
              <textarea
                value={instagramCookiesPaste}
                onChange={(e) => setInstagramCookiesPaste(e.target.value)}
                placeholder="# Netscape HTTP Cookie File\n.instagram.com	TRUE	/	..."
                rows={5}
                className="w-full px-4 py-2 bg-parchment-light border-2 border-sepia-light rounded focus:ring-2 focus:ring-sepia-dark focus:border-sepia-dark text-antique-800 placeholder-antique-400 font-mono text-sm"
              />
              <button
                onClick={handleSaveInstagramCookies}
                disabled={savingCookies || !instagramCookiesPaste.trim()}
                className="px-4 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-typewriter font-bold transition-colors disabled:opacity-50"
              >
                {savingCookies ? 'Saving…' : 'Save Instagram session'}
              </button>
            </div>
          )}
        </div>

        {/* Saved Content Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-typewriter font-bold text-antique-800 tracking-wide">
              Saved Content
            </h3>
            <button
              onClick={() => {
                setShowSavedContent(!showSavedContent);
                if (!showSavedContent) {
                  loadSavedContent();
                }
              }}
              className="px-4 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-typewriter font-bold transition-colors"
            >
              {showSavedContent ? 'Hide' : 'Show'} Saved Content
            </button>
          </div>

          {showSavedContent && (
            <div className="antique-card rounded-lg p-6">
              {loadingContent ? (
                <p className="text-antique-600 font-mono text-center py-4">Loading...</p>
              ) : savedContent.length === 0 ? (
                <p className="text-antique-600 font-mono text-center py-4">
                  No saved content yet. Click "Discover Content" to find posts matching your preferences!
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedContent.map((item: any) => {
                    const hashtags = item.hashtags 
                      ? (typeof item.hashtags === 'string' ? JSON.parse(item.hashtags) : item.hashtags)
                      : [];
                    return (
                      <div
                        key={item.id}
                        className="bg-parchment-light border-2 border-sepia-light rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.caption || 'Content'}
                            className="w-full h-48 object-cover rounded mb-3"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="space-y-2">
                          {item.caption && (
                            <p className="text-antique-800 font-mono text-sm line-clamp-3">
                              {item.caption}
                            </p>
                          )}
                          {item.author && (
                            <p className="text-sepia-dark font-mono text-xs">
                              By: {item.author}
                            </p>
                          )}
                          {hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {hashtags.slice(0, 3).map((tag: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-xs text-antique-600 font-mono"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.score != null && (
                            <p className="text-xs text-antique-600 font-mono">
                              Relevance: {(item.score * 100).toFixed(0)}%
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-antique-600 font-mono mr-1">Rate for better picks:</span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await contentAPI.rate(item.id, 1);
                                  await loadSavedContent();
                                } catch (e) {
                                  // ignore
                                }
                              }}
                              title="Thumbs up — more like this"
                              className={`p-1.5 rounded border-2 font-mono text-sm transition-colors ${item.rating === 1 ? 'bg-green-100 border-green-500 text-green-800' : 'bg-parchment-light border-sepia-light text-antique-600 hover:border-sepia hover:bg-sepia-light'}`}
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await contentAPI.rate(item.id, -1);
                                  await loadSavedContent();
                                } catch (e) {
                                  // ignore
                                }
                              }}
                              title="Thumbs down — less like this"
                              className={`p-1.5 rounded border-2 font-mono text-sm transition-colors ${item.rating === -1 ? 'bg-red-100 border-red-500 text-red-800' : 'bg-parchment-light border-sepia-light text-antique-600 hover:border-sepia hover:bg-sepia-light'}`}
                            >
                              👎
                            </button>
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center mt-3 px-3 py-1 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-mono text-sm transition-colors"
                          >
                            View on Instagram →
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Newsletters Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-typewriter font-bold text-antique-800 tracking-wide">
              Your Newsletters
            </h3>
            <button
              onClick={() => {
                setShowNewsletters(!showNewsletters);
                if (!showNewsletters) {
                  loadNewsletters();
                }
              }}
              className="px-4 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-typewriter font-bold transition-colors"
            >
              {showNewsletters ? 'Hide' : 'Show'} Newsletters
            </button>
          </div>

          {showNewsletters && (
            <div className="antique-card rounded-lg p-6">
              {loadingNewsletters ? (
                <p className="text-antique-600 font-mono text-center py-4">Loading...</p>
              ) : newsletters.length === 0 ? (
                <p className="text-antique-600 font-mono text-center py-4">
                  No newsletters yet. Click "Send Test Newsletter" to create your first one!
                </p>
              ) : (
                <div className="space-y-4">
                  {newsletters.map((newsletter: any) => {
                    const sentDate = new Date(newsletter.sentAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div
                        key={newsletter.id}
                        className="bg-parchment-light border-2 border-sepia-light rounded-lg p-5"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-lg font-typewriter font-bold text-antique-800 mb-1">
                              {newsletter.subject}
                            </h4>
                            <p className="text-sm text-antique-600 font-mono">
                              Sent: {sentDate}
                            </p>
                          </div>
                          {newsletter.items && newsletter.items.length > 0 && (
                            <span className="text-xs text-antique-600 font-mono bg-sepia-light px-2 py-1 rounded">
                              {newsletter.items.length} items
                            </span>
                          )}
                        </div>
                        
                        {/* Newsletter Content Preview */}
                        <div 
                          className="text-antique-700 font-mono text-sm max-h-40 overflow-y-auto mb-3 prose prose-sm"
                          dangerouslySetInnerHTML={{ 
                            __html: newsletter.content?.substring(0, 500) + (newsletter.content?.length > 500 ? '...' : '') || 'No content' 
                          }}
                        />

                        {/* Content Items */}
                        {newsletter.items && newsletter.items.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-sepia-light">
                            <p className="text-xs font-mono font-semibold text-antique-700 mb-2">
                              Content Items:
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {newsletter.items.map((item: any, idx: number) => {
                                const contentItem = item.contentItem;
                                if (!contentItem) return null;
                                
                                return (
                                  <div
                                    key={item.id}
                                    className="bg-parchment-DEFAULT border border-sepia-light rounded p-2"
                                  >
                                    {contentItem.imageUrl && (
                                      <img
                                        src={contentItem.imageUrl}
                                        alt={contentItem.caption || 'Content'}
                                        className="w-full h-24 object-cover rounded mb-1"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    )}
                                    {contentItem.caption && (
                                      <p className="text-xs text-antique-700 font-mono line-clamp-2">
                                        {contentItem.caption.substring(0, 60)}...
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1 mt-1">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await contentAPI.rate(contentItem.id, 1);
                                            await loadNewsletters();
                                            await loadSavedContent();
                                          } catch (e) {
                                            // ignore
                                          }
                                        }}
                                        title="Thumbs up — more like this"
                                        className={`p-1 rounded border font-mono text-xs transition-colors ${contentItem.rating === 1 ? 'bg-green-100 border-green-500 text-green-800' : 'bg-parchment-light border-sepia-light text-antique-600 hover:border-sepia hover:bg-sepia-light'}`}
                                      >
                                        👍
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await contentAPI.rate(contentItem.id, -1);
                                            await loadNewsletters();
                                            await loadSavedContent();
                                          } catch (e) {
                                            // ignore
                                          }
                                        }}
                                        title="Thumbs down — less like this"
                                        className={`p-1 rounded border font-mono text-xs transition-colors ${contentItem.rating === -1 ? 'bg-red-100 border-red-500 text-red-800' : 'bg-parchment-light border-sepia-light text-antique-600 hover:border-sepia hover:bg-sepia-light'}`}
                                      >
                                        👎
                                      </button>
                                    </div>
                                    {contentItem.url && (
                                      <a
                                        href={contentItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-sepia-dark font-mono underline"
                                      >
                                        View →
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* View Full Content Button */}
                        <button
                          onClick={() => {
                            const newWindow = window.open();
                            if (newWindow) {
                              newWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <title>${newsletter.subject}</title>
                                    <style>
                                      body {
                                        font-family: 'Courier New', monospace;
                                        max-width: 800px;
                                        margin: 40px auto;
                                        padding: 20px;
                                        background: #faf5eb;
                                        color: #4a3d2e;
                                      }
                                      .header {
                                        border-bottom: 2px solid #d4c4a8;
                                        padding-bottom: 20px;
                                        margin-bottom: 30px;
                                      }
                                      h1 { color: #8b7355; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="header">
                                      <h1>${newsletter.subject}</h1>
                                      <p>Sent: ${sentDate}</p>
                                    </div>
                                    <div>${newsletter.content}</div>
                                  </body>
                                </html>
                              `);
                            }
                          }}
                          className="mt-3 w-full px-3 py-2 bg-sepia hover:bg-sepia-dark text-antique-50 rounded font-mono text-sm transition-colors"
                        >
                          View Full Newsletter
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
