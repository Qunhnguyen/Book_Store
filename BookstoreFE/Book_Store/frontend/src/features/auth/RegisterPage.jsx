import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../app/context/AuthContext';
import { AuthApi, getErrorMessage } from '../../api/client';
import AuthBackground from './components/AuthBackground';
import '../../shared/styles/global.css';

export default function RegisterPage() {
    const [name, setName] = useState('');
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
            await AuthApi.register({ name, email, password });
            const loginResponse = await AuthApi.login({ email, password });

            login(loginResponse);
            navigate('/');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'row-reverse', // Flip layout for variety
            backgroundColor: '#ffffff',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}>
            {/* Left Side (Actually Right side now due to row-reverse) - Animated Background */}
            <div style={{
                flex: '1.2',
                display: 'block',
                position: 'relative',
                overflow: 'hidden'
            }} className="auth-left-panel">
                <AuthBackground 
                    type="register" 
                    quote="The Sanctuary for the Written Word."
                    subtext="EST. MMXXIV • LONDON • PARIS • DIGITAL"
                />
            </div>

            {/* Right Side (Actually Left side now) - Register Form */}
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
                        <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#131517', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>Join our community of readers</h2>
                        <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>Become part of the sanctuary and enjoy curated literary experiences.</p>
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

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label htmlFor="name" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div>
                                <input
                                    id="name"
                                    type="text"
                                    placeholder="Arthur Dent"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px 14px 48px',
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
                            <label htmlFor="email" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="reader@sanctuary.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px 14px 48px',
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
                            <label htmlFor="password" style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
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
                                        padding: '14px 16px 14px 48px',
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
                                marginTop: '12px',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 6px -1px rgba(74, 75, 207, 0.2)'
                            }}
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <div style={{ marginTop: '32px', textAlign: 'center' }}>
                        <div style={{ position: 'relative', margin: '24px 0', borderTop: '1px solid #f3f4f6' }}>
                            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#ffffff', padding: '0 12px', fontSize: '12px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or register with</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                            <button style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#374151', cursor: 'pointer' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.9 3.22-2.3 4.26-1.04.74-2.52 1.32-4.48 1.32-3.82 0-7-2.92-7-7s3.18-7 7-7c2.12 0 3.76.84 4.9 1.94l2.46-2.46C18.8 3.12 16.24 2 12.48 2 6.74 2 2 6.74 2 12.5S6.74 23 12.48 23c3.12 0 5.48-1.02 7.34-3A8.8 8.8 0 0 0 22.3 12c0-.76-.06-1.46-.18-2.12h-9.64z"></path></svg>
                                Google
                            </button>
                            <button style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#374151', cursor: 'pointer' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.96.95-2.04 1.43-3.08 1.43-1.41 0-2.09-.84-3.95-.84-1.85 0-2.61.82-3.89.82-1.02 0-2.22-.48-3.32-1.57C.86 18.17 0 15 0 12.2c0-2.28.46-4.13 1.57-5.5.96-1.18 2.22-1.89 3.49-1.89 1.05 0 1.85.5 2.87.5 1.01 0 1.57-.5 2.87-.5 1.38 0 2.5.7 3.44 1.8.44.57 1.05 1.63 1.05 3.03 0 3.04-2.4 4.09-2.4 6.7 0 1.14.48 2.05 1.25 2.94M12.03 5.3c-.02-2.13 1.56-3.95 3.52-4.3.02 2.13-1.56 3.95-3.52 4.3"></path></svg>
                                Apple
                            </button>
                        </div>

                        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                            Already have an account? <Link to="/login" style={{ color: '#4a4bcf', fontWeight: '700', textDecoration: 'none' }}>Log In</Link>
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: 'auto', padding: '40px 0', borderTop: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500', textAlign: 'center', marginBottom: '16px' }}>
                        BY CREATING AN ACCOUNT, YOU AGREE TO OUR <br/>
                        <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>PRIVACY POLICY</span> & <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>TERMS OF SERVICE</span>
                    </p>
                </div>
            </div>

            {/* Global Styles for Navigation Links */}
            <div style={{
                position: 'fixed',
                bottom: '15px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '24px',
                fontSize: '14px',
                color: '#6b7280',
                zIndex: 100
            }}>
                <Link to="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</Link>
                <Link to="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</Link>
                <Link to="#" style={{ color: 'inherit', textDecoration: 'none' }}>Shipping & Returns</Link>
                <Link to="#" style={{ color: 'inherit', textDecoration: 'none' }}>Contact Us</Link>
                <span style={{ marginLeft: '40px' }}>© 2024 Lumina Books. A Sanctuary for the Written Word.</span>
            </div>
        </div>
    );
}
