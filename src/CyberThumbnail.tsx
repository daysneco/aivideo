import React from 'react';
import { AbsoluteFill } from 'remotion';
import { bookScript } from './data/bookScript';
import { VIDEO_CONFIG } from './config';

export const CyberThumbnail: React.FC = () => {
  const title = (bookScript.bookTitle || '').replace(/[《》]/g, '').trim();
  const author = bookScript.bookAuthor?.trim() || '';
  const publisher = bookScript.publisher?.trim() || '';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '40%',
          background: VIDEO_CONFIG.THEME.GRADIENT_TOP,
          borderBottom: VIDEO_CONFIG.THEME.NEON_BORDER,
          boxShadow: VIDEO_CONFIG.THEME.NEON_GLOW,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: VIDEO_CONFIG.THEME.GRADIENT_BOTTOM,
          borderTop: VIDEO_CONFIG.THEME.NEON_BORDER,
          boxShadow: VIDEO_CONFIG.THEME.NEON_GLOW_REVERSE,
        }}
      />

      <div
        style={{
          marginTop: '25%', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          width: '90%',
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: 130,
            fontWeight: 'bold',
            color: VIDEO_CONFIG.TITLE_COLOR,
            margin: 0,
            fontStyle: 'italic',
            letterSpacing: 8,
            textShadow: VIDEO_CONFIG.TITLE_GLOW,
          }}
        >
          {title}
        </h1>
        
        <div
          style={{
            width: 300,
            height: 4,
            background: VIDEO_CONFIG.TITLE_COLOR,
            margin: '40px 0',
            boxShadow: VIDEO_CONFIG.TITLE_GLOW,
            opacity: 0.6,
          }}
        />

        {(author || publisher) ? (
          <>
            {author ? (
              <h2
                style={{
                  fontSize: 60,
                  fontWeight: 'normal',
                  color: '#94a3b8',
                  margin: 0,
                  letterSpacing: 4,
                  textShadow: '0 0 10px rgba(255,255,255,0.3)',
                }}
              >
                {author}
              </h2>
            ) : null}
            {publisher ? (
              <p
                style={{
                  fontSize: 34,
                  color: '#64748b',
                  margin: author ? '12px 0 0' : 0,
                  letterSpacing: 2,
                }}
              >
                {publisher}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div style={{
        position: 'absolute',
        top: 40,
        left: 40,
        width: 100,
        height: 100,
        borderTop: '2px solid #fbbf24',
        borderLeft: '2px solid #fbbf24',
        opacity: 0.3
      }} />
      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 40,
        width: 100,
        height: 100,
        borderBottom: '2px solid #fbbf24',
        borderRight: '2px solid #fbbf24',
        opacity: 0.3
      }} />
    </AbsoluteFill>
  );
};
