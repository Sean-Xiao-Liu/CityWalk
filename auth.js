import { auth, provider } from './config/firebase-config.js';

export const handleSignIn = async () => {
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('登录错误:', error);
    }
};

export const handleSignOut = async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('登出错误:', error);
    }
};

export const initAuthListeners = (onAuthStateChanged) => {
    auth.onAuthStateChanged(onAuthStateChanged);
}; 