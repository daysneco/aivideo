# 多源书籍封面获取工具

## 功能特点

本工具支持从多个数据源获取书籍封面图片，具有智能语言检测功能：

### 统一搜索策略
- **所有书名**：优先使用已知直接URL → OpenLibrary → Google Books → 维基百科 → 豆瓣

### 数据源支持
1. **增强封面获取** - 高质量封面库（无需API密钥）
2. **DuckDuckGo Images** - 隐私保护图片搜索（无需API密钥）
3. **Google Images** - 图片搜索（优先3D封面，需要API配置）
4. **OpenLibrary** - 开源图书馆数据库（最佳英文书籍）
5. **Google Books** - Google图书API（免费，无需API密钥）
6. **维基百科** - MediaWiki API（知名书籍条目）
7. **豆瓣** - 豆瓣读书（中文书籍优先）

## 使用方法

### 基本用法

```bash
# 使用npm脚本
npm run fetch-book-cover-multi "书籍名称"

# 或直接运行脚本
node scripts/fetch-book-cover-multi.mjs "书籍名称"
```

### 示例

```bash
# 中文书名（豆瓣优先）
npm run fetch-book-cover-multi "被讨厌的勇气"
npm run fetch-book-cover-multi "小狗钱钱"

# 英文书名（OpenLibrary优先）
npm run fetch-book-cover-multi "The Courage to Be Disliked"
npm run fetch-book-cover-multi "Rich Dad Poor Dad"
```

## 输出结果

成功获取封面后，会显示：

```
🎉 封面获取成功！
============================================================
书名: The Courage to Be Disliked
作者: Ichiro Kishimi
数据源: Google Books
封面URL: https://books.google.com/books/content?id=...
保存路径: /Users/.../public/book_cover_real.png
============================================================

✅ 封面已保存到 public/book_cover_real.png
   视频会自动使用这个封面文件
```

## 技术细节

### 统一搜索策略

**所有书名搜索顺序：**
已知直接URL → 增强封面 → DuckDuckGo Images → Google Images → OpenLibrary → Google Books → 维基百科 → 豆瓣

#### 直接URL支持
对于热门书籍，系统内置了高质量的封面URL：
- 《被讨厌的勇气》：使用Google Books高质量封面
- The Courage to Be Disliked：使用Google Books高质量封面

这确保了即使API搜索失败，也能获取到可靠的封面。

### API特性

1. **已知直接URL**: 对于热门书籍，系统内置高质量封面URL，确保可靠性
2. **增强封面获取**: 使用预定义高质量封面库，无需API密钥，快速获取优质封面
3. **DuckDuckGo Images**: 隐私保护的图片搜索，无需API密钥
4. **Google Images**: 智能3D封面选择，需要API配置 (可选)
5. **OpenLibrary**: 使用ISBN或书名搜索，获取高清封面，支持多种尺寸
6. **Google Books**: 免费API，无需密钥，支持多种格式，有效性验证，改进的搜索逻辑
7. **维基百科**: 通过页面标题获取相关图片，适用于知名作品，支持多语言搜索
8. **豆瓣**: 内置常见中文书籍ID映射，支持搜索fallback

### 错误处理

- 自动检测图片有效性（大小和格式验证）
- 如果某个数据源失败，自动尝试下一个
- 如果所有数据源都失败，提供详细的故障排除建议
- 网络错误会自动重试失败的请求

### 图片格式

- 输入：自动检测（JPG/PNG/WebP等）
- 输出：统一转换为PNG格式
- 保存位置：`public/book_cover_real.png`

## 故障排除

### 常见问题

1. **中文书名搜索失败**
   - 尝试使用英文书名
   - 检查书名拼写是否正确

2. **所有数据源都失败**
   - 书籍可能比较小众或较新
   - 可以手动下载封面图片并放置到 `public/book_cover_real.png`
   - 或者使用上传脚本: `npm run upload-cover "图片URL或本地路径"`

3. **网络连接问题**
   - 检查网络连接
   - 工具会自动重试失败的请求

### 手动处理

如果自动获取失败，可以：

#### 方法1: 直接放置文件
1. 在网上搜索书籍封面
2. 下载图片文件 (JPEG/PNG格式)
3. 重命名为 `book_cover_real.png`
4. 放置到 `public/` 目录

#### 方法2: 使用上传脚本 (推荐)
```bash
# 从URL上传
npm run upload-cover "https://example.com/book-cover.jpg"

# 从本地文件上传
npm run upload-cover "~/Downloads/book_cover.jpg"
npm run upload-cover "/path/to/your/cover.png"
```

上传脚本会自动验证图片格式和质量。

## 集成说明

该工具会自动将封面保存到 `public/book_cover_real.png`，Remotion视频会自动使用这个文件作为书籍封面的显示图片。

## 配置说明

### Google Images 搜索设置（可选）

要启用Google Images搜索功能，需要配置Google Custom Search API：

1. **获取API密钥**:
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 创建新项目或选择现有项目
   - 启用 "Custom Search API"
   - 创建API密钥

2. **创建自定义搜索引擎**:
   - 访问 [Custom Search Engine](https://cse.google.com/)
   - 创建新的搜索引擎
   - 设置搜索整个网络（不限制特定网站）
   - 获取搜索引擎ID

3. **环境变量配置**:
   ```bash
   GOOGLE_API_KEY=your_api_key_here
   GOOGLE_CSE_ID=your_search_engine_id_here
   ```

### 🎨 智能3D图片选择算法

Google Images搜索使用先进的评分算法，自动选择最佳封面：

#### 📊 评分标准（总分0-40分）
- **3D相关** (+15分): 包含"3D"、"3-D"、"three dimensional"等关键词
- **高质量艺术** (+8分): "art"、"illustration"、"design"、"digital art"等
- **书籍封面** (+6分): "book cover"、"cover art"、"book design"等
- **合适尺寸** (+5分): 适合书籍封面的纵向比例和分辨率
- **高分辨率** (+3分): 宽度≥800px，高度≥1000px

#### 🎯 选择策略
1. **多关键词搜索**: 尝试8种不同的搜索组合
2. **智能评分**: 为每张图片计算综合评分
3. **质量过滤**: 只选择评分≥10分的图片
4. **最佳候选**: 显示前3名候选图片的评分详情

#### 🔍 搜索关键词示例
```
"被讨厌的勇气 book cover 3D"
"被讨厌的勇气 3D book cover"
"被讨厌的勇气 book cover illustration 3D"
"被讨厌的勇气 book cover digital art 3D"
"被讨厌的勇气 book cover 3D render"
"被讨厌的勇气 book cover 3D mockup"
```

#### 📋 输出示例
```
🏆 最佳候选图片:
  1. 分数:28 | 原因:3D相关,高质量艺术,合适尺寸 | 1200x1600
  2. 分数:22 | 原因:3D相关,书籍封面,高分辨率 | 1000x1400
  3. 分数:18 | 原因:高质量艺术,合适尺寸 | 900x1200
```

## 数据源信息

- **Google Images**: https://developers.google.com/custom-search/v1/overview (需要API配置)
- **OpenLibrary**: https://openlibrary.org/
- **Google Books**: https://books.google.com/
- **维基百科**: https://zh.wikipedia.org/
- **豆瓣**: https://book.douban.com/