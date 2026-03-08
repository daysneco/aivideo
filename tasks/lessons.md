# Lessons & Standards

## Cover Generation Standard (Established: 2026-03-08)
- **Background Generation**: Use Gemini to generate a high-quality, cinematic landscape photograph or artistic digital painting background. Prompt must emphasize "high resolution, dramatic lighting, no text, no characters."
- **3D Composition**: Use `scripts/composite-cover.mjs`.
  - **Cover Resize**: Fixed width of 850px.
  - **Transformation**: Rotate by -5 degrees (with transparent background).
  - **Effect**: Add a drop shadow with blur and offset for 3D depth.
  - **Output**: Composite onto the AI-generated landscape background centered.
