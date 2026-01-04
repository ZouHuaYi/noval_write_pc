/**
 * Extract Validator - Extract 输出校验器
 * 使用 JSON Schema + 语义规则校验 Extract 输出
 */

class ExtractValidator {
  constructor() {
    // 禁止进入 fact_claims 的 predicate 关键词
    this.forbiddenFactPredicates = [
      'attempt', 'attempted', 'tried', 'failed', 'trying',
      'maybe', 'possibly', 'might', 'could', 'perhaps'
    ];

    // 禁止进入 fact_claims 的 value 关键词
    this.forbiddenFactValues = [
      'failed', 'failure', 'unsuccessful', 'trying', 'attempting'
    ];

    // 伪长期状态字段（应该用 event 或 debuff）
    this.pseudoStateFields = [
      'cultivation_status', 'attempt_status', 'trial_status'
    ];
  }

  /**
   * 校验完整的 Extract
   */
  validateExtract(extracted) {
    const errors = [];
    const warnings = [];

    // 1. 校验 fact_claims（并修正 certainty）
    if (extracted.fact_claims) {
      for (let i = 0; i < extracted.fact_claims.length; i++) {
        const claim = extracted.fact_claims[i];
        const factErrors = this.validateFactClaim(claim);
        errors.push(...factErrors);
        // 修正 certainty（如果等于 1）
        this.fixCertainty(extracted.fact_claims, i);
      }
    }

    // 2. 校验 state_claims（并修正 certainty）
    if (extracted.state_claims) {
      for (let i = 0; i < extracted.state_claims.length; i++) {
        const claim = extracted.state_claims[i];
        const stateErrors = this.validateStateClaim(claim);
        errors.push(...stateErrors);
        // 修正 certainty（如果等于 1）
        this.fixCertainty(extracted.state_claims, i);
      }
    }

    // 3. 校验 event_claims（并修正 certainty）
    if (extracted.event_claims) {
      for (let i = 0; i < extracted.event_claims.length; i++) {
        const claim = extracted.event_claims[i];
        const eventErrors = this.validateEventClaim(claim);
        errors.push(...eventErrors);
        // 修正 certainty（如果等于 1）
        this.fixCertainty(extracted.event_claims, i);
      }
    }

    // 4. 校验结构完整性
    const structureErrors = this.validateStructure(extracted);
    errors.push(...structureErrors);

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * 安全地修正 certainty（避免 "Assignment to constant variable" 错误）
   */
  fixCertainty(claimsArray, index) {
    try {
      const claim = claimsArray[index];
      if (claim && typeof claim.certainty === 'number' && claim.certainty === 1) {
        // 使用 Object.assign 创建新对象，避免直接修改
        claimsArray[index] = Object.assign({}, claim, { certainty: 0.95 });
        console.log(`   ⚠️  certainty = 1 被降为 0.95（Extractor 层不能给绝对事实）`);
      }
    } catch (error) {
      // 如果无法修改，记录警告但不抛出错误
      console.warn(`   ⚠️  无法修正 certainty: ${error.message}`);
    }
  }

  /**
   * 校验 fact_claim
   */
  validateFactClaim(claim) {
    const errors = [];

    // 1. 必须字段检查
    if (!claim.subject || !claim.predicate || !claim.value) {
      errors.push({
        type: 'missing_field',
        claim: claim,
        message: 'fact_claim 缺少必要字段 (subject, predicate, value)'
      });
      return errors;
    }

    // 2. 禁止 predicate 检查
    const predicateLower = claim.predicate.toLowerCase();
    for (const forbidden of this.forbiddenFactPredicates) {
      if (predicateLower.includes(forbidden)) {
        errors.push({
          type: 'forbidden_predicate',
          claim: claim,
          message: `fact_claim 的 predicate 包含禁止词: ${forbidden}。这应该是 event_claim，不是 fact_claim`
        });
      }
    }

    // 3. 禁止 value 检查
    const valueLower = claim.value.toLowerCase();
    for (const forbidden of this.forbiddenFactValues) {
      if (valueLower.includes(forbidden)) {
        errors.push({
          type: 'forbidden_value',
          claim: claim,
          message: `fact_claim 的 value 包含禁止词: ${forbidden}。这应该是 event_claim，不是 fact_claim`
        });
      }
    }

    // 4. evidence 检查
    if (!claim.evidence || claim.evidence.length < 10) {
      errors.push({
        type: 'insufficient_evidence',
        claim: claim,
        message: 'fact_claim 的 evidence 不足（至少 10 个字符）'
      });
    }

    // 5. certainty 检查（Extractor 层不能给 1，最高 0.95）
    if (typeof claim.certainty !== 'number' || claim.certainty < 0 || claim.certainty > 0.95) {
      errors.push({
        type: 'invalid_certainty',
        claim: claim,
        message: 'fact_claim 的 certainty 必须是 0-0.95 之间的数字（Extractor 层不能给 1）'
      });
    }

    return errors;
  }

  /**
   * 校验 state_claim
   */
  validateStateClaim(claim) {
    const errors = [];

    // 1. 必须字段检查
    if (!claim.character || !claim.field || claim.value === undefined) {
      errors.push({
        type: 'missing_field',
        claim: claim,
        message: 'state_claim 缺少必要字段 (character, field, value)'
      });
      return errors;
    }

    // 2. 伪长期状态检查
    if (this.pseudoStateFields.includes(claim.field)) {
      errors.push({
        type: 'pseudo_state',
        claim: claim,
        message: `state_claim 的 field "${claim.field}" 是伪长期状态。应该使用 event_claim 或 temporary_debuff`
      });
    }

    // 4. certainty 检查（Extractor 层不能给 1，最高 0.95）
    if (typeof claim.certainty !== 'number' || claim.certainty < 0 || claim.certainty > 0.95) {
      errors.push({
        type: 'invalid_certainty',
        claim: claim,
        message: 'state_claim 的 certainty 必须是 0-0.95 之间的数字（Extractor 层不能给 1）'
      });
    }

    return errors;
  }

  /**
   * 校验 event_claim
   */
  validateEventClaim(claim) {
    const errors = [];

    // 1. 必须字段检查
    if (!claim.type || !claim.subject || !claim.evidence) {
      errors.push({
        type: 'missing_field',
        claim: claim,
        message: 'event_claim 缺少必要字段 (type, subject, evidence)'
      });
      return errors;
    }

    // 3. certainty 检查（Extractor 层不能给 1，最高 0.95）
    if (typeof claim.certainty !== 'number' || claim.certainty < 0 || claim.certainty > 0.95) {
      errors.push({
        type: 'invalid_certainty',
        claim: claim,
        message: 'event_claim 的 certainty 必须是 0-0.95 之间的数字（Extractor 层不能给 1）'
      });
    }

    return errors;
  }

  /**
   * 校验结构完整性
   */
  validateStructure(extracted) {
    const errors = [];

    // 1. 必须有 chapter
    if (!extracted.chapter || typeof extracted.chapter !== 'number') {
      errors.push({
        type: 'missing_chapter',
        message: 'Extract 缺少 chapter 字段'
      });
    }

    // 2. 检查冗余（同一事实出现多次）
    const duplicates = this.checkDuplicates(extracted);
    if (duplicates.length > 0) {
      errors.push({
        type: 'duplicate_claims',
        message: `发现重复的主张: ${duplicates.join(', ')}`
      });
    }

    return errors;
  }

  /**
   * 检查重复主张
   */
  checkDuplicates(extracted) {
    const seen = new Set();
    const duplicates = [];

    // 检查 fact_claims 和 state_claims 的重复
    if (extracted.fact_claims) {
      for (const claim of extracted.fact_claims) {
        const key = `fact_${claim.subject}_${claim.predicate}_${claim.value}`;
        if (seen.has(key)) {
          duplicates.push(key);
        }
        seen.add(key);
      }
    }

    if (extracted.state_claims) {
      for (const claim of extracted.state_claims) {
        const key = `state_${claim.character}_${claim.field}_${claim.value}`;
        if (seen.has(key)) {
          duplicates.push(key);
        }
        seen.add(key);
      }
    }

    return duplicates;
  }

  /**
   * 过滤无效的 claims（自动修复）
   */
  filterInvalidClaims(extracted) {
    const filtered = {
      chapter: extracted.chapter,
      fact_claims: [],
      state_claims: [],
      event_claims: [],
      foreshadow_candidates: extracted.foreshadow_candidates || [],
      inference_only: extracted.inference_only || [],
      concept_mentions: extracted.concept_mentions || []
    };

    // 过滤 fact_claims
    if (extracted.fact_claims) {
      for (const claim of extracted.fact_claims) {
        const errors = this.validateFactClaim(claim);
        if (errors.length === 0) {
          filtered.fact_claims.push(claim);
        } else {
          // 如果是禁止的 predicate/value，转为 event_claim
          const hasForbidden = errors.some(e => 
            e.type === 'forbidden_predicate' || e.type === 'forbidden_value'
          );
          if (hasForbidden && extracted.event_claims) {
            // 尝试转换为 event
            filtered.event_claims.push({
              type: 'breakthrough_attempt',
              subject: claim.subject,
              result: claim.value.includes('failed') ? 'failed' : 'unknown',
              evidence: claim.evidence || '',
              certainty: claim.certainty || 0.8
            });
          }
        }
      }
    }

    // 过滤 state_claims
    if (extracted.state_claims) {
      for (const claim of extracted.state_claims) {
        const errors = this.validateStateClaim(claim);
        if (errors.length === 0) {
          filtered.state_claims.push(claim);
        } else if (errors.some(e => e.type === 'pseudo_state')) {
          // 伪长期状态转为 event_claim
          if (!filtered.event_claims) filtered.event_claims = [];
          filtered.event_claims.push({
            type: 'state_change_attempt',
            subject: claim.character,
            field: claim.field,
            result: 'failed',
            evidence: claim.evidence || '',
            certainty: claim.certainty || 0.8
          });
        }
      }
    }

    // 保留 event_claims
    if (extracted.event_claims) {
      for (const claim of extracted.event_claims) {
        const errors = this.validateEventClaim(claim);
        if (errors.length === 0) {
          filtered.event_claims.push(claim);
        }
      }
    }

    return filtered;
  }

  /**
   * 检查是否是状态归因推断（禁止）
   */
  isStateIdentityInference(claim) {
    if (!claim || typeof claim !== 'string') {
      return false;
    }

    const claimLower = claim.toLowerCase();
    
    // 检查是否涉及世界状态身份
    const stateIdentityKeywords = [
      '是.*修士', '是.*期', '是.*境界',
      '可能是.*修士', '可能是.*期',
      '已经.*突破', '已经.*达到',
      '身份是', '境界是', '修为是'
    ];

    for (const keyword of stateIdentityKeywords) {
      const regex = new RegExp(keyword);
      if (regex.test(claimLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 从 claim 中提取 subject
   */
  extractSubject(claim) {
    if (!claim || typeof claim !== 'string') {
      return 'unknown';
    }

    // 简单提取：假设第一个词是 subject
    const words = claim.split(/\s+/);
    return words[0] || 'unknown';
  }
}

module.exports = ExtractValidator;

