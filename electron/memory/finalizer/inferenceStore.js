/**
 * Inference Store - 推断存储
 * 存储 AI 推断，不进 core，只用于提示和注意
 */

const fs = require('fs');
const path = require('path');

class InferenceStore {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.storePath = path.join(workspaceRoot, '.novel-agent', 'inference_store.json');
  }

  /**
   * 确保目录存在
   */
  ensureDirectory() {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 加载所有推断
   */
  loadInferences() {
    this.ensureDirectory();
    if (!fs.existsSync(this.storePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ 加载推断失败:', error.message);
      return [];
    }
  }

  /**
   * 保存所有推断
   */
  saveInferences(inferences) {
    this.ensureDirectory();
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(inferences, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ 保存推断失败:', error.message);
      throw error;
    }
  }

  /**
   * 添加推断
   * @param {Object} inference - 推断对象
   * @param {string} inference.claim - 推断内容
   * @param {string} inference.basis - 依据
   * @param {number} inference.confidence - 置信度 (0-1)
   * @param {number} inference.chapter - 章节号
   */
  addInference(inference) {
    const inferences = this.loadInferences();
    
    // 检查是否已存在相似的推断
    const existing = inferences.find(
      inf => inf.claim === inference.claim && inf.chapter === inference.chapter
    );

    if (existing) {
      // 更新置信度（取较高值）
      if (inference.confidence > existing.confidence) {
        existing.confidence = inference.confidence;
        existing.basis = inference.basis;
        existing.updated_at = new Date().toISOString();
        this.saveInferences(inferences);
      }
      return existing.id;
    }

    const newInference = {
      id: `inf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      claim: inference.claim,
      basis: inference.basis || '',
      confidence: Math.max(0, Math.min(1, inference.confidence || 0.5)),
      chapter: inference.chapter,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    inferences.push(newInference);
    this.saveInferences(inferences);
    
    console.log(`   📝 添加推断: ${inference.claim.substring(0, 50)}... (置信度: ${newInference.confidence})`);
    return newInference.id;
  }

  /**
   * 获取指定章节的推断
   */
  getInferencesByChapter(chapterNumber) {
    const inferences = this.loadInferences();
    return inferences.filter(inf => inf.chapter === chapterNumber);
  }

  /**
   * 获取所有待处理的推断（置信度 < 0.7）
   */
  getPendingInferences() {
    const inferences = this.loadInferences();
    return inferences.filter(inf => inf.status === 'pending' && inf.confidence < 0.7);
  }

  /**
   * 标记推断为已确认（转为 fact）
   */
  markConfirmed(inferenceId) {
    const inferences = this.loadInferences();
    const inference = inferences.find(inf => inf.id === inferenceId);
    if (inference) {
      inference.status = 'confirmed';
      inference.updated_at = new Date().toISOString();
      this.saveInferences(inferences);
    }
  }

  /**
   * 标记推断为已拒绝
   */
  markRejected(inferenceId) {
    const inferences = this.loadInferences();
    const inference = inferences.find(inf => inf.id === inferenceId);
    if (inference) {
      inference.status = 'rejected';
      inference.updated_at = new Date().toISOString();
      this.saveInferences(inferences);
    }
  }

  /**
   * 清理旧推断（可选）
   */
  cleanup(maxAge = 30) {
    const inferences = this.loadInferences();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const filtered = inferences.filter(inf => {
      const created = new Date(inf.created_at);
      // 保留未处理的或最近创建的
      return inf.status === 'pending' || created > cutoffDate;
    });

    if (filtered.length < inferences.length) {
      this.saveInferences(filtered);
      console.log(`   🧹 清理了 ${inferences.length - filtered.length} 个旧推断`);
    }
  }
}

module.exports = InferenceStore;

