# Project Files and Images Update API

## Overview

The project update API now supports multiple ways to manage files and images without losing existing data.

## API Endpoint

```
PUT /projects/:id
```

## Request Body Options

### 1. Replace All Files/Images (Backward Compatible)

```json
{
  "files": ["https://example.com/file1.pdf", "https://example.com/file2.docx"],
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.png"]
}
```

**Behavior**: Deletes all existing files/images and replaces with new ones.

### 2. Add Files/Images Without Deleting Existing Ones ✨ NEW

```json
{
  "add_files": ["https://example.com/new-file.pdf"],
  "add_images": ["https://example.com/new-image.jpg"]
}
```

**Behavior**: Adds new files/images while keeping all existing ones.

### 3. Remove Specific Files/Images ✨ NEW

```json
{
  "remove_files": ["https://example.com/old-file.pdf"],
  "remove_images": ["https://example.com/old-image.jpg"]
}
```

**Behavior**: Removes only the specified files/images by URL.

### 4. Combined Operations ✨ NEW

```json
{
  "add_files": ["https://example.com/new-file.pdf"],
  "remove_files": ["https://example.com/old-file.pdf"],
  "add_images": ["https://example.com/new-image.jpg"],
  "remove_images": ["https://example.com/old-image.jpg"]
}
```

**Behavior**: Performs add and remove operations in sequence.

## Field Definitions

| Field           | Type       | Description                                   |
| --------------- | ---------- | --------------------------------------------- |
| `files`         | `string[]` | Replace all existing files with these URLs    |
| `images`        | `string[]` | Replace all existing images with these URLs   |
| `add_files`     | `string[]` | Add new files without removing existing ones  |
| `add_images`    | `string[]` | Add new images without removing existing ones |
| `remove_files`  | `string[]` | Remove files by matching their URLs           |
| `remove_images` | `string[]` | Remove images by matching their URLs          |

## Operation Priority

1. **Replace Operations** (`files`, `images`) take priority over add/remove operations
2. If `files` is provided, `add_files` and `remove_files` are ignored
3. If `images` is provided, `add_images` and `remove_images` are ignored
4. **Remove Operations** are executed before **Add Operations**

## Examples

### Example 1: Add New Files to Existing Project

```json
{
  "add_files": [
    "https://storage.example.com/project-spec-v2.pdf",
    "https://storage.example.com/requirements.docx"
  ]
}
```

### Example 2: Remove Specific Images

```json
{
  "remove_images": ["https://storage.example.com/old-screenshot.png"]
}
```

### Example 3: Add New Images and Remove Old Ones

```json
{
  "add_images": ["https://storage.example.com/new-diagram.png"],
  "remove_images": ["https://storage.example.com/outdated-mockup.jpg"]
}
```

### Example 4: Complete File Management

```json
{
  "add_files": ["https://storage.example.com/updated-plan.pdf"],
  "remove_files": ["https://storage.example.com/old-plan.pdf"],
  "add_images": ["https://storage.example.com/new-screenshot.png"],
  "remove_images": ["https://storage.example.com/old-screenshot.png"]
}
```

## Validation Rules

- All URL fields must be arrays of strings
- URLs should be valid HTTP/HTTPS URLs
- File names are automatically extracted from URLs
- All fields are optional

## Response

The API returns the updated project with all current files and images included in the response.

## Benefits

✅ **No Data Loss**: Add files without losing existing ones  
✅ **Selective Removal**: Remove specific files/images by URL  
✅ **Backward Compatible**: Existing `files` and `images` fields work as before  
✅ **Flexible Operations**: Combine add/remove operations as needed  
✅ **URL-Based Management**: Easy integration with file storage services
