import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../app/context/AuthContext';
import { post, urls, getErrorMessage } from '../../api/client';
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
            await post(`${urls.customer}/register/`, { name, email, password });
            const loginResponse = await post(`${urls.customer}/login/`, { email, password });

            login(loginResponse);
            navigate('/');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at top right, #e8eafd 0%, #f3f4f8 100%)',
            padding: '20px'
        }}>
            <div className="auth-card" style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '440px',
                borderRadius: '24px',
                padding: '48px 40px',
                boxShadow: '0 24px 48px rgba(18, 24, 43, 0.08)',
                border: '1px solid #e6e8f0',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <Link to="/" className="logo" style={{ textDecoration: 'none', fontSize: '36px', display: 'inline-block', marginBottom: '8px' }}>Lumina</Link>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#12182b', letterSpacing: '-0.02em', fontWeight: '800' }}>Create Account</h2>
                    <p style={{ margin: '0', color: '#646d85', fontSize: '15px' }}>Start your next chapter with us today</p>
                </div>

                {error && (
                    <div style={{
                        color: '#c53030',
                        marginBottom: '24px',
                        padding: '12px 16px',
                        backgroundColor: '#fff5f5',
                        borderRadius: '12px',
                        border: '1px solid #fed7d7',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#454d64' }}>Full Name</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="e.g. Jane Austen"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                boxSizing: 'border-box',
                                border: '1px solid #d9deef',
                                borderRadius: '12px',
                                background: '#f8f9fd',
                                color: '#12182b',
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#4a4bcf'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(74, 75, 207, 0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#d9deef'; e.target.style.background = '#f8f9fd'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div>
                        <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#454d64' }}>Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                boxSizing: 'border-box',
                                border: '1px solid #d9deef',
                                borderRadius: '12px',
                                background: '#f8f9fd',
                                color: '#12182b',
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#4a4bcf'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(74, 75, 207, 0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#d9deef'; e.target.style.background = '#f8f9fd'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#454d64' }}>Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Create a strong password"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                boxSizing: 'border-box',
                                border: '1px solid #d9deef',
                                borderRadius: '12px',
                                background: '#f8f9fd',
                                color: '#12182b',
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#4a4bcf'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(74, 75, 207, 0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#d9deef'; e.target.style.background = '#f8f9fd'; e.target.style.boxShadow = 'none'; }}
                        />
                        <p style={{ marginTop: '8px', fontSize: '13px', color: '#8f99b3', margin: '6px 0 0 2px' }}>Must be at least 8 characters long.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '12px',
                            padding: '14px',
                            backgroundColor: loading ? '#8284e5' : '#4a4bcf',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            fontWeight: '700',
                            boxShadow: '0 4px 14px rgba(74, 75, 207, 0.3)',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
                        onMouseOut={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
                        onMouseDown={(e) => !loading && (e.target.style.transform = 'translateY(1px)')}
                        onMouseUp={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
                    >
                        {loading ? 'Setting up account...' : 'Create Account'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: '#646d85' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: '#4a4bcf', fontWeight: '700', textDecoration: 'none' }}>
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
