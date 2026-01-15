// Supabase 客户端初始化
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 从 window 对象获取 Supabase 配置（由服务器端注入）
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

console.log('Supabase 配置检查:', {
  url: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 20)}...` : '未设置',
  key: SUPABASE_ANON_KEY ? '已设置' : '未设置'
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL 或 Anon Key 未配置，请检查环境变量');
  console.error('请在 .env 文件中设置:');
  console.error('SUPABASE_URL=your_supabase_project_url');
  console.error('SUPABASE_ANON_KEY=your_supabase_anon_key');
}

// 创建 Supabase 客户端
let supabase;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    console.log('Supabase 客户端初始化成功');
  } else {
    // 创建一个假的客户端，避免导入错误
    supabase = null;
    console.warn('Supabase 客户端未初始化，因为配置缺失');
  }
} catch (error) {
  console.error('Supabase 客户端初始化失败:', error);
  supabase = null;
}

// 导出认证相关函数
export const auth = {
  // Google 登录
  async signInWithGoogle() {
    if (!supabase) {
      const error = new Error('Supabase 客户端未初始化，请检查配置');
      console.error(error);
      return { data: null, error };
    }
    
    try {
      console.log('开始 Google OAuth 登录，重定向到:', `${window.location.origin}/auth/callback`);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('OAuth 登录错误:', error);
      } else {
        console.log('OAuth 登录成功，重定向 URL:', data?.url);
      }
      
      return { data, error };
    } catch (err) {
      console.error('signInWithGoogle 异常:', err);
      return { data: null, error: err };
    }
  },

  // 登出
  async signOut() {
    if (!supabase) {
      return { error: new Error('Supabase 客户端未初始化') };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // 获取当前用户
  getCurrentUser() {
    if (!supabase) {
      return Promise.resolve({ data: { user: null }, error: new Error('Supabase 客户端未初始化') });
    }
    return supabase.auth.getUser();
  },

  // 监听认证状态变化
  onAuthStateChange(callback) {
    if (!supabase) {
      console.warn('Supabase 客户端未初始化，无法监听认证状态');
      return { data: { subscription: null }, error: new Error('Supabase 客户端未初始化') };
    }
    return supabase.auth.onAuthStateChange(callback);
  },

  // 获取当前会话
  getSession() {
    if (!supabase) {
      return Promise.resolve({ data: { session: null }, error: new Error('Supabase 客户端未初始化') });
    }
    return supabase.auth.getSession();
  },
};

// 导出 supabase 客户端（如果需要直接使用）
export { supabase };

