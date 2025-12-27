const axios = require('axios');

/**
 * 调用 OpenAI 兼容的 API
 * @param {Object} config - 模型配置
 * @param {Array} messages - 消息列表
 * @param {Object} options - 其他选项
 * @returns {Promise<string>} - 返回 AI 回复
 */
async function callLLM(config, messages, options = {}) {
  const { baseUrl, apiKey, model } = config;
  
  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: options.timeout || 6000000 // 60秒超时
      }
    );
    
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('Invalid response from LLM API');
    }
  } catch (error) {
    console.error('LLM API 调用失败:', error.message);
    
    if (error.response) {
      // 服务器返回错误
      throw new Error(`API Error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      throw new Error(`Network Error: 无法连接到 API (${baseUrl})`);
    } else {
      // 其他错误
      throw new Error(`Error: ${error.message}`);
    }
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

