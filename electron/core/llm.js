const axios = require('axios');
const logger = require('../utils/logger');

/**
 * 调用 OpenAI 兼容的 API
 * @param {Object} config - 模型配置
 * @param {Array} messages - 消息列表
 * @param {Object} options - 其他选项
 * @returns {Promise<string>} - 返回 AI 回复
 */
async function callLLM(config, messages, options = {}) {
  const { baseUrl, apiKey, model } = config;
  const startTime = Date.now();
  
  // 准备请求数据
  const requestData = {
    model: model,
    messages: messages,
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 2000,
    stream: false
  };
  
  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: options.timeout || 6000000 // 60秒超时
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message.content;
      const usage = response.data.usage || null;
      
      // 记录成功的请求
      logger.logLLMRequest(
        {
          model,
          baseUrl,
          messages,
          temperature: requestData.temperature,
          maxTokens: requestData.max_tokens
        },
        {
          success: true,
          content,
          usage
        },
        duration
      );
      
      return content;
    } else {
      throw new Error('Invalid response from LLM API');
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    let errorMessage = '';
    
    if (error.response) {
      // 服务器返回错误
      errorMessage = `API Error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage = `Network Error: 无法连接到 API (${baseUrl})`;
    } else {
      // 其他错误
      errorMessage = `Error: ${error.message}`;
    }
    
    // 记录失败的请求
    logger.logLLMRequest(
      {
        model,
        baseUrl,
        messages,
        temperature: requestData.temperature,
        maxTokens: requestData.max_tokens
      },
      {
        success: false,
        error: errorMessage
      },
      duration
    );
    
    console.error('LLM API 调用失败:', errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * 流式调用 LLM（暂未实现，预留接口）
 */
async function callLLMStream(config, messages, onChunk, options = {}) {
  // TODO: 实现流式响应
  throw new Error('Stream mode not implemented yet');
}

module.exports = {
  callLLM,
  callLLMStream
};

