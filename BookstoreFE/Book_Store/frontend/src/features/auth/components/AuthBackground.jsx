/* AuthBackground.jsx */
import React, { useMemo } from 'react';
import './AuthBackground.css';
import loginBg from '../../../assets/auth/login-bg.png';
import registerBg from '../../../assets/auth/register-bg.png';

const BookIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
);

const QuillIcon = () => (
    <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="m14.5 12.5-8 8a2.11 2.11 0 0 1-3-3l8-8"></path>
        <path d="m16 8 2-2"></path>
        <path d="m19.5 4.5-4 4L11 4 3 12c0 6 6 10 12 6l8-8-3.5-3.5Z"></path>
    </svg>
);

const SparkleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path>
    </svg>
);

export default function AuthBackground({ type = 'login', quote, subtext }) {
    const bgImage = type === 'login' ? loginBg : registerBg;

    // Generate random positions for particles
    const particles = useMemo(() => {
        return Array.from({ length: 15 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 15}s`,
            duration: `${10 + Math.random() * 10}s`,
            size: `${2 + Math.random() * 3}px`
        }));
    }, []);

    // Floating objects with random delays
    const floatingItems = useMemo(() => [
        { icon: <BookIcon />, top: '15%', left: '10%', delay: '0s' },
        { icon: <QuillIcon />, top: '40%', left: '85%', delay: '2s' },
        { icon: <BookIcon />, top: '70%', left: '15%', delay: '4s' },
        { icon: <SparkleIcon />, top: '10%', left: '90%', delay: '1s' },
        { icon: <SparkleIcon />, top: '60%', left: '80%', delay: '5s' },
    ], []);

    return (
        <div className="auth-bg-container">
            <img src={bgImage} alt="Background" className="auth-bg-image" />
            <div className="auth-overlay"></div>
            
            {/* Particles */}
            {particles.map(p => (
                <div 
                    key={p.id} 
                    className="particle" 
                    style={{ 
                        left: p.left, 
                        animationDelay: p.delay, 
                        animationDuration: p.duration,
                        width: p.size,
                        height: p.size
                    }} 
                />
            ))}

            {/* Floating Objects */}
            {floatingItems.map((item, idx) => (
                <div 
                    key={idx} 
                    className="floating-object" 
                    style={{ top: item.top, left: item.left, animationDelay: item.delay }}
                >
                    {item.icon}
                </div>
            ))}

            <div className="auth-quote-container">
                <div className="auth-quote-line"></div>
                <h1 className="auth-quote-text">{quote}</h1>
                <div className="auth-subtext">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a4 4 0 0 0-4-4H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a4 4 0 0 1 4-4h6z"></path>
                    </svg>
                    {subtext}
                </div>
            </div>
        </div>
    );
}
