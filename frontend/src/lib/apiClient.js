import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const mediaUrl = (path) => `${BACKEND_URL}${path}`;

export const getCategories = () => axios.get(`${API}/categories`).then((r) => r.data.categories);

export const getArticles = (params = {}) =>
  axios.get(`${API}/articles`, { params }).then((r) => r.data);

export const getArticle = (id) => axios.get(`${API}/articles/${id}`).then((r) => r.data);

export const createArticle = (payload) =>
  axios.post(`${API}/articles`, payload).then((r) => r.data);

export const deleteArticle = (id) => axios.delete(`${API}/articles/${id}`).then((r) => r.data);

export const uploadPhotos = (articleId, files) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return axios
    .post(`${API}/articles/${articleId}/photos`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const getPhotos = () => axios.get(`${API}/photos`).then((r) => r.data);
export const deletePhoto = (id) => axios.delete(`${API}/photos/${id}`).then((r) => r.data);

export const getWatermarkSettings = () =>
  axios.get(`${API}/settings/watermark`).then((r) => r.data);
export const saveWatermarkSettings = (payload) =>
  axios.put(`${API}/settings/watermark`, payload).then((r) => r.data);

export const watermarkPreviewUrl = ({ text, opacity, font_size, position }, bust) =>
  `${API}/watermark/preview?text=${encodeURIComponent(text)}&opacity=${opacity}&font_size=${font_size}&position=${position}&t=${bust}`;
