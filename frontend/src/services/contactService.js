import API from './api';

const contactService = {
  /**
   * Submit contact / support form
   * @param {Object} data - { name, email, role, subject, message }
   * @returns {Promise<Object>}
   */
  submitContactForm: (data) => API.post('/contact', data),
};

export default contactService;
