/**
 * Auth Service
 * Handles Firebase Authentication
 */
import { auth } from "../firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        let msg = "Login failed";
        if(error.code === 'auth/invalid-credential') msg = "Invalid email or password";
        if(error.code === 'auth/too-many-requests') msg = "Too many failed attempts. Try again later.";
        return { success: false, error: msg };
    }
};

export const signupUser = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        let msg = "Signup failed";
        if(error.code === 'auth/email-already-in-use') msg = "Email already in use";
        if(error.code === 'auth/weak-password') msg = "Password should be at least 6 characters";
        return { success: false, error: msg };
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        return true;
    } catch (error) {
        console.error("Logout error:", error);
        return false;
    }
};

export const onAuthChange = (callback) => {
    onAuthStateChanged(auth, callback);
};