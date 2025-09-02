/* ======================
   HAIR BY RHIANNON - MAIN JAVASCRIPT
   main.js
   ====================== */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeWebsite();
});

/* ======================
   INITIALIZATION
   ====================== */
function initializeWebsite() {
    initializeNavigation();
    initializeForms();
    initializeAnimations();
    initializePortfolio();
    initializeConsultationForm();
    
    console.log('Hair By Rhiannon website initialized successfully');
}

/* ======================
   NAVIGATION FUNCTIONALITY
   ====================== */
function initializeNavigation() {
    const navbar = document.querySelector('.navbar');
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        }
    });
    
    // Mobile menu toggle (placeholder for future mobile menu implementation)
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            console.log('Mobile menu toggle clicked - implement mobile menu functionality');
            // Future: Toggle mobile menu visibility
        });
    }
    
    // Smooth scrolling for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Update active navigation link based on current page
    updateActiveNavLink();
}

function updateActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || 
            (currentPage === '' && href === 'index.html') ||
            (currentPage === 'index.html' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/* ======================
   FORM FUNCTIONALITY
   ====================== */
function initializeForms() {
    // Basic contact form
    const quickForm = document.querySelector('.quick-form');
    if (quickForm) {
        quickForm.addEventListener('submit', handleQuickContactSubmit);
    }
    
    // Add form validation helpers
    addFormValidation();
}

function handleQuickContactSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Basic validation
    const name = formData.get('name')?.trim();
    const email = formData.get('email')?.trim();
    const message = formData.get('message')?.trim();
    
    if (!name || !email || !message) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address.', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    // Simulate form submission (replace with actual backend call)
    setTimeout(() => {
        showNotification('Thank you for your message! I\'ll get back to you within 24 hours.', 'success');
        form.reset();
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }, 2000);
}

function addFormValidation() {
    // Add real-time validation to form inputs
    const formInputs = document.querySelectorAll('.form-input, .form-textarea');
    
    formInputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateFormField(this);
        });
        
        input.addEventListener('input', function() {
            // Clear error styling on input
            this.style.borderColor = '#e0e0e0';
        });
    });
}

function validateFormField(field) {
    const value = field.value.trim();
    const isRequired = field.hasAttribute('required');
    
    if (isRequired && !value) {
        field.style.borderColor = '#dc3545';
        return false;
    }
    
    if (field.type === 'email' && value && !isValidEmail(value)) {
        field.style.borderColor = '#dc3545';
        return false;
    }
    
    field.style.borderColor = '#28a745';
    return true;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/* ======================
   CONSULTATION FORM FUNCTIONALITY
   ====================== */
function initializeConsultationForm() {
    const consultationForm = document.getElementById('consultationForm');
    if (consultationForm) {
        consultationForm.addEventListener('submit', handleConsultationSubmit);
        
        // Set minimum date to today
        const dateInput = document.getElementById('preferredDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
        }
        
        // Service selection visual feedback
        const serviceCheckboxes = document.querySelectorAll('.service-option input[type="checkbox"]');
        serviceCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const card = this.nextElementSibling;
                if (this.checked) {
                    card.style.transform = 'translateY(-2px)';
                } else {
                    card.style.transform = 'translateY(0)';
                }
            });
        });
    }
}

function handleConsultationSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    
    // Validate required fields
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.style.borderColor = '#dc3545';
            isValid = false;
        } else {
            field.style.borderColor = '#e0e0e0';
        }
    });
    
    // Check required checkboxes
    const requiredCheckboxes = document.querySelectorAll('input[name="agreements[]"]');
    requiredCheckboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.closest('.checkbox-item').style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
            isValid = false;
        } else {
            checkbox.closest('.checkbox-item').style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
        }
    });
    
    if (!isValid) {
        showNotification('Please fill in all required fields and check the required agreements.', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    // Simulate form submission (replace with actual backend processing)
    setTimeout(() => {
        // Hide form and show success message
        form.style.display = 'none';
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.classList.add('show');
        }
        
        // Reset button (in case user goes back)
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Consultation Request';
    }, 2000);
}

/* ======================
   PORTFOLIO FUNCTIONALITY
   ====================== */
function initializePortfolio() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    const resultsCount = document.getElementById('resultsCount');
    
    if (filterButtons.length === 0) return; // Not on portfolio page
    
    // Add click events to filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            
            const filter = button.getAttribute('data-filter');
            filterGallery(filter, galleryItems, resultsCount);
        });
    });
    
    // Initialize portfolio with animation observer
    initializePortfolioAnimations(galleryItems);
    
    // Set initial count
    if (resultsCount) {
        resultsCount.textContent = `${galleryItems.length} items`;
    }
}

function filterGallery(filter, galleryItems, resultsCount) {
    let visibleCount = 0;
    
    galleryItems.forEach((item, index) => {
        const categories = item.getAttribute('data-category');
        
        if (filter === 'all' || (categories && categories.includes(filter))) {
            item.style.display = 'block';
            // Add animation delay for staggered effect
            item.style.animationDelay = `${index * 0.1}s`;
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Update results count
    if (resultsCount) {
        resultsCount.textContent = `${visibleCount} items`;
    }
}

function initializePortfolioAnimations(galleryItems) {
    // Add intersection observer for animation on scroll
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, { threshold: 0.1 });

        galleryItems.forEach(item => {
            observer.observe(item);
        });
    }
}

// Load more items functionality (placeholder for Instagram API)
function loadMoreItems() {
    showNotification('Load more functionality will be implemented with Instagram API integration or database backend.', 'info');
    
    // In the future, this function would:
    // 1. Make API call to get more images
    // 2. Create new gallery items
    // 3. Add them to the gallery with animations
}

/* ======================
   LIGHTBOX FUNCTIONALITY
   ====================== */
function openLightbox(imageSrc) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    
    if (lightbox && lightboxImage) {
        lightboxImage.src = imageSrc;
        lightbox.classList.add('active');
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
    }
}

// Initialize lightbox if it exists
function initializeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        // Close lightbox when clicking outside image
        lightbox.addEventListener('click', function(e) {
            if (e.target === this) {
                closeLightbox();
            }
        });
        
        // Close lightbox with escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeLightbox();
            }
        });
    }
}

/* ======================
   ANIMATION UTILITIES
   ====================== */
function initializeAnimations() {
    initializeLightbox();
    
    // Add scroll animations to elements
    if ('IntersectionObserver' in window) {
        const animatedElements = document.querySelectorAll('.slide-up, .fade-in');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                }
            });
        }, { threshold: 0.1 });

        animatedElements.forEach(element => {
            observer.observe(element);
        });
    }
}

/* ======================
   NOTIFICATION SYSTEM
   ====================== */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Add notification styles if they don't exist
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 100px;
                right: 20px;
                max-width: 400px;
                padding: 1rem;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                animation: slideInRight 0.5s ease;
            }
            
            .notification-info { background: var(--info-blue); color: white; }
            .notification-success { background: var(--success-green); color: white; }
            .notification-error { background: var(--danger-red); color: white; }
            .notification-warning { background: var(--warning-orange); color: white; }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                margin-left: auto;
                padding: 0.25rem;
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        case 'info':
        default: return 'info-circle';
    }
}

/* ======================
   UTILITY FUNCTIONS
   ====================== */

// Format phone numbers
function formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phoneNumber;
}

// Validate forms
function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.style.borderColor = '#dc3545';
            isValid = false;
        } else {
            field.style.borderColor = '#e0e0e0';
        }
    });
    
    return isValid;
}

// Smooth scroll to element
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Local storage helpers (for future use)
function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('Local storage not available');
    }
}

function getLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.warn('Local storage not available');
        return null;
    }
}

/* ======================
   INSTAGRAM API INTEGRATION (Future Implementation)
   ====================== */

// Placeholder for future Instagram Basic Display API integration
async function loadInstagramPosts() {
    // This will be implemented when Instagram API is set up
    console.log('Instagram API integration placeholder');
    
    // Future implementation:
    // 1. Get access token
    // 2. Fetch user media
    // 3. Process images
    // 4. Add to portfolio gallery
    
    showNotification('Instagram integration will be implemented in Phase 2', 'info');
}

// Create gallery item from Instagram post data
function createGalleryItem(postData) {
    // Future implementation for creating gallery items from Instagram API data
    return `
        <div class="gallery-item fade-in" data-category="${postData.category}">
            <div class="gallery-image">
                <img src="${postData.image}" alt="${postData.caption}" loading="lazy">
            </div>
            <div class="gallery-overlay">
                <span>Click to View Larger</span>
            </div>
            <div class="gallery-content">
                <div class="gallery-category">${postData.category}</div>
                <h3 class="gallery-title">${postData.title}</h3>
                <p class="gallery-description">${postData.description}</p>
            </div>
        </div>
    `;
}

/* ======================
   EXPORT FUNCTIONS (for use in HTML pages)
   ====================== */

// Make functions available globally for HTML onclick handlers
window.loadMoreItems = loadMoreItems;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.scrollToElement = scrollToElement;
window.showNotification = showNotification;

console.log('Hair By Rhiannon JavaScript loaded successfully');