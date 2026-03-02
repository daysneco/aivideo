import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { bookScript } from './data/bookScript';

export const ClassicCover: React.FC = () => {
  const title = (bookScript.bookTitle || '').replace(/[《》]/g, '').trim();
  const author = bookScript.bookAuthor?.trim() || '';
  const publisher = bookScript.publisher?.trim() || '';
  const portraitUrl = staticFile('book_cover.png');

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        fontFamily: '"LXGW WenKai", serif',
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {/* 书封铺满画布，整体缩放不裁剪 */}
      <Img
        src={portraitUrl}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />

      {/* 底部渐变：从透明到深黑，给文字留出清晰区域 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 书名 + 作者：压在底部渐变上，大标题、少装饰 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          padding: '0 40px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: 700,
            fontStyle: 'italic',
            margin: 0,
            letterSpacing: 4,
            lineHeight: 1.2,
            color: '#fff',
            textShadow: '0 2px 24px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
        {(author || publisher) && (
          <p
            style={{
              marginTop: 16,
              marginBottom: 0,
              fontSize: 26,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: 1,
            }}
          >
            {[author, publisher].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
