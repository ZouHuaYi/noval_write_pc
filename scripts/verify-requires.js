/**
 * 验证所有 require 路径的脚本
 */

const fs = require('fs');
const path = require('path');

const electronDir = path.join(__dirname, '..', 'electron');

function findJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findJSFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

function resolveRequirePath(requirePath, fromFile) {
  if (!requirePath.startsWith('.')) {
    return null; // 不是相对路径，跳过
  }
  
  const fromDir = path.dirname(fromFile);
  let resolvedPath = path.resolve(fromDir, requirePath);
  
  // 尝试添加 .js 扩展名
  if (!fs.existsSync(resolvedPath)) {
    resolvedPath = resolvedPath + '.js';
  }
  
  // 尝试作为目录查找 index.js
  if (!fs.existsSync(resolvedPath)) {
    const indexPath = path.join(resolvedPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }
  
  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

const jsFiles = findJSFiles(electronDir);
const errors = [];

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
    
    if (requireMatch) {
      const requirePath = requireMatch[1];
      const resolved = resolveRequirePath(requirePath, file);
      
      if (resolved === null && requirePath.startsWith('.')) {
        const relativePath = path.relative(process.cwd(), file);
        errors.push({
          file: relativePath,
          line: i + 1,
          require: requirePath,
          lineContent: line.trim()
        });
      }
    }
  }
}

if (errors.length === 0) {
  console.log('✅ 所有路径引用检查通过！');
  process.exit(0);
} else {
  console.log(`\n❌ 发现 ${errors.length} 个路径问题：\n`);
  for (const error of errors) {
    console.log(`文件: ${error.file}`);
    console.log(`行号: ${error.line}`);
    console.log(`路径: ${error.require}`);
    console.log(`内容: ${error.lineContent}`);
    console.log('');
  }
  process.exit(1);
}

