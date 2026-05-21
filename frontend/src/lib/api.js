import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  withCredentials: true,
  headers: { 
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "any"
  },
});

console.log("API baseURL:", api.defaults.baseURL);

api.interceptors.request.use((config) => {
  console.log("Request:", config.method.toUpperCase(), config.url);
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
