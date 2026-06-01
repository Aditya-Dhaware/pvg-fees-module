import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

const client = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  withCredentials: true,
  headers: { 
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "any"
  },
});

console.log("Client API baseURL:", client.defaults.baseURL);

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("DEBUG: 401 Unauthorized encountered. Clearing tokens and redirecting...");
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      
      const authUrl = process.env.REACT_APP_AUTH_FRONTEND_URL || process.env.VITE_AUTH_URL || "";
      if (authUrl) {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.replace(`${authUrl}/login?redirect=${currentUrl}`);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
