import React from 'react';
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

loadFont({
  family: 'LXGW WenKai',
  url: staticFile('LXGWWenKai.ttf'),
  format: 'truetype',
});

const FONT_FAMILY = 'LXGW WenKai';

export const ThemeNavBar: React.FC<{ items: string[] }> = ({ items }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        minHeight: 72,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 0',
        gap: '16px',
        fontFamily: `"${FONT_FAMILY}", "KaiTi", "SimKai", serif`,
        fontSize: 36,
        color: '#000',
      }}
    >
      {items.map((text, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span
              style={{
                color: '#000',
                userSelect: 'none',
              }}
            >
              |
            </span>
          )}
          <span>{text}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
