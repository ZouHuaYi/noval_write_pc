import { ref, type Ref } from 'vue';
import { 
  buildFileTree, 
  collectExpandedFolderIds, 
  findNodeById, 
  restoreExpandedState, 
  type TreeNode 
} from '../utils/fileTree';

export function useFileSystem(
  showAlert: (message: string, title?: string, type?: 'info' | 'warning' | 'danger') => void,
  showConfirm: (message: string, onConfirm: () => void, title?: string, type?: 'info' | 'warning' | 'danger') => void,
  showPrompt: (title: string, onConfirm: (value: string) => void, placeholder?: string, defaultValue?: string) => void
) {
  const workspaceRoot = ref<string>('');
  const rootName = ref<string>('未打开工作区');
  const fileTree = ref<TreeNode[]>([]);
  const currentFile = ref<TreeNode | null>(null);
  const isModified = ref(false);

  // 打开单个文件
  const openLocalFile = async (
    onFileOpened?: (content: string) => void
  ) => {
    if (!window.api?.openLocalFile) {
      showAlert('无法调用 API，请重启 Electron', '错误', 'danger');
      return;
    }

    const result = await window.api.openLocalFile();
    if (!result) return;

    const tempNode: TreeNode = {
      id: result.path,
      name: result.name,
      type: 'file',
      path: result.path,
      ext: result.name.includes('.') ? result.name.split('.').pop() || '' : '',
      content: result.content,
      loaded: true
    };

    currentFile.value = tempNode;
    isModified.value = false;

    if (onFileOpened) {
      onFileOpened(result.content);
    }
  };

  // 打开文件夹
  const openFolder = async (
    onFolderOpened?: () => void
  ) => {
    if (!window.api?.openFolder) {
      showAlert('无法调用 API，请重启 Electron', '错误', 'danger');
      return;
    }

    const result = await window.api.openFolder();
    if (!result) return;

    workspaceRoot.value = result.rootDir;
    rootName.value = result.rootName || result.rootDir;
    fileTree.value = buildFileTree(result.files, result.rootDir);

    currentFile.value = null;
    isModified.value = false;

    if (onFolderOpened) {
      onFolderOpened();
    }
  };

  // 从历史记录打开工作区
  const openWorkspaceFromHistory = async (
    data: { rootDir: string; rootName: string; files: any[] },
    onOpened?: () => void
  ) => {
    workspaceRoot.value = data.rootDir;
    rootName.value = data.rootName || data.rootDir;
    fileTree.value = buildFileTree(data.files, data.rootDir);

    currentFile.value = null;
    isModified.value = false;

    if (onOpened) {
      onOpened();
    }
  };

  // 打开文件（懒加载内容）
  const openFileById = async (
    id: string,
    onFileOpened?: (content: string) => void
  ) => {
    const node = findNodeById(fileTree.value, id);
    if (!node || node.type !== 'file') return;

    if (node.loaded) {
      currentFile.value = node;
      isModified.value = false;
      if (onFileOpened) {
        onFileOpened(node.content || '');
      }
      return;
    }

    if (!window.api?.readFile || !node.path) {
      showAlert('无法读取文件：API 不可用', '错误', 'danger');
      return;
    }

    const result = await window.api.readFile(node.path);
    if (!result.success) {
      showAlert(`读取文件失败：${result.error}`, '错误', 'danger');
      return;
    }

    node.content = result.content || '';
    node.loaded = true;
    currentFile.value = node;
    isModified.value = false;

    if (onFileOpened) {
      onFileOpened(node.content);
    }
  };

  // 保存文件
  const saveFile = async (
    content: string,
    onSaved?: () => void
  ) => {
    if (!currentFile.value?.path || !window.api?.writeFile) {
      return;
    }

    const result = await window.api.writeFile(currentFile.value.path, content);

    if (result.success) {
      currentFile.value.content = content;
      isModified.value = false;
      if (onSaved) {
        onSaved();
      }
    } else {
      showAlert(`保存失败：${result.error}`, '错误', 'danger');
    }
  };

  // 新建文件
  const createFile = async (
    fileName: string,
    onCreated?: () => void
  ) => {
    if (!window.api?.createFile) {
      showAlert('API 不可用，请重启 Electron', '错误', 'danger');
      return;
    }

    if (!workspaceRoot.value) {
      showAlert('请先打开一个工作区', '提示', 'info');
      return;
    }

    const filePath = `${workspaceRoot.value}/${fileName.trim()}`;
    const result = await window.api.createFile(filePath, '');

    if (result.success) {
      if (onCreated) {
        onCreated();
      }
    } else {
      showAlert(`新建文件失败：${result.error}`, '错误', 'danger');
    }
  };

  // 新建文件夹
  const createFolder = async (
    folderName: string,
    onCreated?: () => void
  ) => {
    if (!window.api?.createFolder) {
      showAlert('API 不可用，请重启 Electron', '错误', 'danger');
      return;
    }

    if (!workspaceRoot.value) {
      showAlert('请先打开一个工作区', '提示', 'info');
      return;
    }

    const folderPath = `${workspaceRoot.value}/${folderName.trim()}`;
    const result = await window.api.createFolder(folderPath);

    if (result.success) {
      if (onCreated) {
        onCreated();
      }
    } else {
      showAlert(`新建文件夹失败：${result.error}`, '错误', 'danger');
    }
  };

  // 删除文件或文件夹
  const deleteFile = async (
    id: string,
    onDeleted?: () => void
  ) => {
    const node = findNodeById(fileTree.value, id);
    if (!node?.path || !window.api?.deleteFile) {
      return;
    }

    const result = await window.api.deleteFile(node.path);

    if (result.success) {
      if (currentFile.value?.id === id) {
        currentFile.value = null;
        isModified.value = false;
      }
      if (onDeleted) {
        onDeleted();
      }
    } else {
      showAlert(`删除失败：${result.error}`, '错误', 'danger');
    }
  };

  // 重命名文件或文件夹
  const renameFile = async (
    id: string,
    newName: string,
    onRenamed?: () => void
  ) => {
    const node = findNodeById(fileTree.value, id);
    if (!node?.path || !window.api?.renameFile) {
      showAlert('API 不可用，请重启 Electron', '错误', 'danger');
      return;
    }

    const oldPath = node.path || node.id;
    const newPath = oldPath.replace(/[^/\\]+$/, newName);

    const result = await window.api.renameFile(oldPath, newPath);

    if (result.success) {
      if (currentFile.value?.id === node.id) {
        currentFile.value.name = newName;
        currentFile.value.path = newPath;
        currentFile.value.id = newPath;
      }
      if (onRenamed) {
        onRenamed();
      }
    } else {
      showAlert(`重命名失败：${result.error}`, '错误', 'danger');
    }
  };

  // 移动文件或文件夹
  const moveFile = async (
    sourceNode: TreeNode,
    targetNode: TreeNode,
    onMoved?: () => void
  ) => {
    if (!sourceNode.path && sourceNode.id) {
      sourceNode.path = sourceNode.id;
    }

    if (!sourceNode.path || !window.api?.moveFile) {
      showAlert('无法移动：源路径无效', '错误', 'danger');
      return;
    }

    const sourcePath = sourceNode.path;
    const targetPath = `${targetNode.id}/${sourceNode.name}`;

    const result = await window.api.moveFile(sourcePath, targetPath);

    if (result.success) {
      if (currentFile.value?.id === sourceNode.id) {
        currentFile.value.path = targetPath;
        currentFile.value.id = targetPath;
      }
      if (onMoved) {
        onMoved();
      }
    } else {
      showAlert(`移动失败：${result.error}`, '错误', 'danger');
    }
  };

  // 刷新文件树
  const refreshFolder = async (onRefreshed?: () => void) => {
    if (!workspaceRoot.value || !window.api?.refreshFolder) {
      return;
    }

    const expandedIds = collectExpandedFolderIds(fileTree.value);
    const result = await window.api.refreshFolder(workspaceRoot.value);

    if (result.success && result.files) {
      fileTree.value = buildFileTree(result.files, workspaceRoot.value);
      restoreExpandedState(fileTree.value, expandedIds);
      if (onRefreshed) {
        onRefreshed();
      }
    } else {
      showAlert(`刷新失败：${result.error}`, '错误', 'danger');
    }
  };

  // 切换文件夹展开/折叠
  const toggleFolder = (id: string) => {
    const node = findNodeById(fileTree.value, id);
    if (node && node.type === 'folder') {
      node.expanded = !node.expanded;
    }
  };

  // 在文件夹中新建文件
  const createFileInFolder = (
    parentNode: TreeNode,
    fileName: string,
    onCreated?: (parentId: string) => void
  ) => {
    if (!window.api?.createFile) {
      showAlert('API 不可用，请重启 Electron', '错误', 'danger');
      return;
    }

    const filePath = `${parentNode.id}/${fileName.trim()}`;
    
    window.api.createFile(filePath, '').then((result) => {
      if (result.success) {
        if (onCreated) {
          onCreated(parentNode.id);
        }
      } else {
        showAlert(`新建文件失败：${result.error}`, '错误', 'danger');
      }
    });
  };

  // 在文件夹中新建文件夹
  const createFolderInFolder = (
    parentNode: TreeNode,
    folderName: string,
    onCreated?: (parentId: string) => void
  ) => {
    if (!window.api?.createFolder) {
      showAlert('API 不可用，请重启 Electron', '错误', 'danger');
      return;
    }

    const folderPath = `${parentNode.id}/${folderName.trim()}`;
    
    window.api.createFolder(folderPath).then((result) => {
      if (result.success) {
        if (onCreated) {
          onCreated(parentNode.id);
        }
      } else {
        showAlert(`新建文件夹失败：${result.error}`, '错误', 'danger');
      }
    });
  };

  return {
    // State
    workspaceRoot,
    rootName,
    fileTree,
    currentFile,
    isModified,
    
    // Methods
    openLocalFile,
    openFolder,
    openWorkspaceFromHistory,
    openFileById,
    saveFile,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    moveFile,
    refreshFolder,
    toggleFolder,
    createFileInFolder,
    createFolderInFolder
  };
}

