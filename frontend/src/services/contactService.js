import API from './api';

const contactService = {
  /**
   * Submit contact / support form.
   * Uses a 30-second timeout so the submit button is never permanently stuck
   * if the backend is slow to respond (e.g. Render cold-start).
   *
   * @param {Object} data - { name, email, role, subject, message }
   * @returns {Promise<Object>}
   * @throws {string} Human-readable error message on failure or timeout
   */
  submitContactForm: async (data) => {
    const response = await API.post('/contact', data, { timeout: 30000 });

    // Guard: treat an unexpected non-success 200 response as an error
    if (response && response.success === false) {
      throw response.message || 'Unable to send your message right now. Please try again later.';
    }

    return response;
  },
};

export default contactService;
