import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../app/context/AuthContext';
import { AuthApi, getErrorMessage } from '../../api/client';
import AuthBackground from './components/AuthBackground';
import '../../shared/styles/global.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await AuthApi.login({ email, password });
            login(response);
            navigate('/');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to login. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            backgroundColor: '#ffffff',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}>
            {/* Left Side - Animated Background */}
            <div style={{
                flex: '1.2',
                display: 'block',
                position: 'relative',
                overflow: 'hidden'
            }} className="auth-left-panel">
                <AuthBackground 
                    type="login" 
                    quote="The silent soul of a house is its library."
                    subtext="Enter the curated sanctuary of thought."
                />
            </div>

            {/* Right Side - Login Form */}
            <div style={{
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 8%',
                backgroundColor: '#ffffff',
                position: 'relative',
                zIndex: 20
            }}>
                <div style={{ maxWidth: '440px', width: '100%', margin: '0 auto' }}>
                    <div style={{ marginBottom: '40px' }}>
                        <Link to="/" style={{ color: '#4a4bcf', textDecoration: 'none', fontWeight: '800', fontSize: '24px', letterSpacing: '-0.02em', display: 'block', marginBottom: '16px' }}>Lumina Books</Link>
                        <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#131517', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>Welcome Back</h2>
                        <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>Continue your journey through the written word.</p>
                    </div>

                    {error && (
                        <div style={{
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fee2e2',
                            color: '#dc2626',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            marginBottom: '24px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label htmlFor="email" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="curator@luminabooks.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#ffffff',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                        color: '#111827'
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#4a4bcf'; e.target.style.boxShadow = '0 0 0 4px rgba(74, 75, 207, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label htmlFor="password" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                <Link to="#" style={{ fontSize: '13px', fontWeight: '600', color: '#4a4bcf', textDecoration: 'none' }}>Forgot Password?</Link>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#ffffff',
                                        fontSize: '15px',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                        color: '#111827'
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#4a4bcf'; e.target.style.boxShadow = '0 0 0 4px rgba(74, 75, 207, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" id="remember" style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4a4bcf' }} />
                            <label htmlFor="remember" style={{ fontSize: '14px', color: '#4b5563', cursor: 'pointer' }}>Remember my session for 30 days</label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '16px',
                                backgroundColor: '#4a4bcf',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease',
                                opacity: loading ? 0.8 : 1
                            }}
                        >
                            {loading ? 'Signing In...' : (
                                <>
                                    Sign In 
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 24px 0' }}>
                            Don't have an account? <Link to="/register" style={{ color: '#4a4bcf', fontWeight: '700', textDecoration: 'none' }}>Join the Library</Link>
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#374151', cursor: 'pointer' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.9 3.22-2.3 4.26-1.04.74-2.52 1.32-4.48 1.32-3.82 0-7-2.92-7-7s3.18-7 7-7c2.12 0 3.76.84 4.9 1.94l2.46-2.46C18.8 3.12 16.24 2 12.48 2 6.74 2 2 6.74 2 12.5S6.74 23 12.48 23c3.12 0 5.48-1.02 7.34-3A8.8 8.8 0 0 0 22.3 12c0-.76-.06-1.46-.18-2.12h-9.64z"></path></svg>
                                GOOGLE
                            </button>
                            <button style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#374151', cursor: 'pointer' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.96.95-2.04 1.43-3.08 1.43-1.41 0-2.09-.84-3.95-.84-1.85 0-2.61.82-3.89.82-1.02 0-2.22-.48-3.32-1.57C.86 18.17 0 15 0 12.2c0-2.28.46-4.13 1.57-5.5.96-1.18 2.22-1.89 3.49-1.89 1.05 0 1.85.5 2.87.5 1.01 0 1.57-.5 2.87-.5 1.38 0 2.5.7 3.44 1.8.44.57 1.05 1.63 1.05 3.03 0 3.04-2.4 4.09-2.4 6.7 0 1.14.48 2.05 1.25 2.94M12.03 5.3c-.02-2.13 1.56-3.95 3.52-4.3.02 2.13-1.56 3.95-3.52 4.3"></path></svg>
                                APPLE
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 'auto', padding: '40px 0', borderTop: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
                        © 2024 THE DIGITAL CURATOR. A SANCTUARY FOR THE WRITTEN WORD.
                    </p>
                </div>
            </div>
        </div>
    );
}
