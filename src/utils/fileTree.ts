// 文件树节点类型
export type TreeNode = {
  id: string; // 唯一 ID（路径）
  name: string; // 显示名称
  type: 'folder' | 'file';
  path?: string; // 文件的完整路径
  relativePath?: string; // 相对路径
  ext?: string; // 文件扩展名
  children?: TreeNode[]; // 子节点（仅 folder 有）
  expanded?: boolean; // 是否展开（仅 folder）
  loaded?: boolean; // 内容是否已加载（仅 file）
  content?: string; // 文件内容（仅 file）
};

/**
 * 把扁平的文件列表转成树形结构
 * @param files 从主进程返回的文件列表
 * @param rootPath 根目录路径
 * @returns 树形节点数组
 */
export function buildFileTree(
  files: { path: string; name: string; relativePath: string; type?: 'file' | 'folder' }[],
  rootPath: string
): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  files.forEach((file) => {
    const parts = file.relativePath.split('/');
    let currentLevel = root;
    let currentPath = rootPath;

    // 遍历路径的每一部分，构建文件夹节点
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      currentPath = `${currentPath}/${folderName}`;
      const folderId = currentPath;

      if (!folderMap.has(folderId)) {
        const folderNode: TreeNode = {
          id: folderId,
          name: folderName,
          type: 'folder',
          path: currentPath,
          children: [],
          expanded: false
        };
        folderMap.set(folderId, folderNode);
        currentLevel.push(folderNode);
      }

      const folderNode = folderMap.get(folderId)!;
      currentLevel = folderNode.children!;
    }

    // 添加文件或空文件夹节点
    const itemName = parts[parts.length - 1];
    
    if (file.type === 'folder') {
      // 这是一个文件夹（可能是空文件夹）
      currentPath = `${currentPath}/${itemName}`;
      const folderId = currentPath;
      
      if (!folderMap.has(folderId)) {
        const folderNode: TreeNode = {
          id: folderId,
          name: itemName,
          type: 'folder',
          path: currentPath,
          children: [],
          expanded: false
        };
        folderMap.set(folderId, folderNode);
        currentLevel.push(folderNode);
      }
    } else {
      // 这是一个文件
      const fileNode: TreeNode = {
        id: file.path,
        name: itemName,
        type: 'file',
        path: file.path,
        relativePath: file.relativePath,
        ext: itemName.includes('.') ? itemName.split('.').pop() || '' : '',
        loaded: false,
        content: ''
      };
      currentLevel.push(fileNode);
    }
  });

  return root;
}

/**
 * 在树中查找节点
 */
export function findNodeById(tree: TreeNode[], id: string): TreeNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 递归获取所有文件节点
 */
export function getAllFiles(tree: TreeNode[]): TreeNode[] {
  const files: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (node.type === 'file') {
        files.push(node);
      } else if (node.children) {
        walk(node.children);
      }
    });
  };
  walk(tree);
  return files;
}

/**
 * 收集所有展开的文件夹 ID
 */
export function collectExpandedFolderIds(tree: TreeNode[]): Set<string> {
  const expandedIds = new Set<string>();
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        if (node.expanded) {
          expandedIds.add(node.id);
        }
        if (node.children) {
          walk(node.children);
        }
      }
    });
  };
  walk(tree);
  return expandedIds;
}

/**
 * 恢复文件夹的展开状态
 */
export function restoreExpandedState(tree: TreeNode[], expandedIds: Set<string>): void {
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        if (expandedIds.has(node.id)) {
          node.expanded = true;
        }
        if (node.children) {
          walk(node.children);
        }
      }
    });
  };
  walk(tree);
}

