export class UIService {
    constructor(travelPlanner) {
        // 保存对 TravelPlanner 实例的引用
        this.travelPlanner = travelPlanner;
        
        // 获取必要的 DOM 元素
        this.searchInput = document.getElementById("location-search");
        this.addButton = document.getElementById("add-location");
        this.currentLanguage = "en";

        // 初始化 UI 组件
        this.initializeLanguageSelector();
        this.initializeWeChatModal();
        this.updateLanguage();

        // 添加默认的行程名称
        this.currentTripName = null;
    }
    
    initializeWeChatModal() {
        const modal = document.getElementById("wechat-modal");
        const wechatLink = document.getElementById("wechat-link");
        const closeBtn = document.querySelector(".close-modal");
    
        wechatLink.addEventListener("click", (e) => {
          e.preventDefault();
          modal.style.display = "block";
          document.body.style.overflow = "hidden"; // 防止背景滚动
        });
    
        closeBtn.addEventListener("click", () => {
          modal.style.display = "none";
          document.body.style.overflow = ""; // 恢复滚动
        });
    
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.style.display = "none";
            document.body.style.overflow = "";
          }
        });
    
        // 添加 ESC 键关闭功能
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && modal.style.display === "block") {
            modal.style.display = "none";
            document.body.style.overflow = "";
          }
        });
      }


      initializeLanguageSelector() {
        const languageSelect = document.getElementById("language-select");
        const languageSelector = document.querySelector(".language-selector");
    
        // 设置初始图标
        languageSelector.setAttribute("data-selected", languageSelect.value);
    
        languageSelect.addEventListener("change", (e) => {
            this.currentLanguage = e.target.value;
            // 更新国旗图标
            languageSelector.setAttribute("data-selected", e.target.value);
            this.updateLanguage();
        });
      }
    
      updateLanguage() {
        const t = translations[this.currentLanguage];
    
        // 首先更新下拉菜单标题，防止被其他更新覆盖
        const savedTripsDropdown = document.querySelector(".saved-trips-dropdown");
        if (savedTripsDropdown) {
            const dropdownButton = savedTripsDropdown.querySelector(".dropdown-button");
            if (dropdownButton) {
                dropdownButton.textContent = t.savedTrips;
            }
            
            // 更新下拉菜单标题
            const dropdownTitle = savedTripsDropdown.querySelector(".dropdown-title");
            if (dropdownTitle) {
                dropdownTitle.textContent = t.savedTrips;
            }

            // 防止导航栏更新影响下拉菜单
            savedTripsDropdown.setAttribute('data-original-title', t.savedTrips);
        }

        // 更新页面标题
        document.title = t.title;

        // 更新导航栏 - 修改这部分，避免影响下拉菜单
        document.querySelector(".logo").textContent = t.title.split("-")[0].trim();
        const navLinks = document.querySelectorAll("nav ul li:not(.saved-trips-dropdown) a");
        navLinks.forEach((link, index) => {
            switch(index) {
                case 0:
                    link.textContent = t.home;
                    break;
                case 1:
                    link.textContent = t.about;
                    break;
                case 2:
                    link.textContent = t.contact;
                    break;
            }
        });

        // 恢复下拉菜单标题
        if (savedTripsDropdown) {
            const dropdownButton = savedTripsDropdown.querySelector(".dropdown-button");
            if (dropdownButton && dropdownButton.textContent !== t.savedTrips) {
                dropdownButton.textContent = t.savedTrips;
            }
        }

        // 更新搜索区域
        this.searchInput.placeholder = t.searchPlaceholder;
        this.addButton.textContent = t.addLocation;
        document.querySelector(".location-hint").textContent = t.locationHint;
    
        // 更新访问顺序面板标题
        const visitOrderPanel = document.querySelector(".visit-order-panel h2");
        if (this.currentTripName) {
            visitOrderPanel.textContent = this.currentTripName;
        } else {
            visitOrderPanel.textContent = t.visitOrder;
        }

        // 更新保存的行程下拉菜单标题
        if (savedTripsDropdown) {
            // 更新下拉菜单按钮文本
            const dropdownButton = savedTripsDropdown.querySelector(".dropdown-button");
            if (dropdownButton) {
                dropdownButton.textContent = t.savedTrips;
            }
            
            // 更新下拉菜单标题
            const dropdownTitle = savedTripsDropdown.querySelector(".dropdown-title");
            if (dropdownTitle) {
                dropdownTitle.textContent = t.savedTrips;
            }
        }

        // 更新保存行程按钮
        const saveTripButton = document.getElementById("save-trip");
        if (saveTripButton) {
            saveTripButton.textContent = t.saveTrip;
        }

        // 更新保存行程模态框
        const saveTripModal = document.getElementById("save-trip-modal");
        if (saveTripModal) {
            const modalTitle = saveTripModal.querySelector("h3");
            if (modalTitle) {
                modalTitle.textContent = t.saveTripTitle;
            }
            const tripNameInput = saveTripModal.querySelector("#trip-name");
            if (tripNameInput) {
                tripNameInput.placeholder = t.enterTripName;
            }
            const saveButton = saveTripModal.querySelector("#confirm-save-trip");
            if (saveButton) {
                saveButton.textContent = t.save;
            }
        }

        // 更新总结区域
        document.querySelector(".summary-section h2").textContent = t.tripSummary;
        const totalStats = document.querySelector(".total-stats").children;
        totalStats[0].firstChild.textContent = `${t.totalTime}: `;
        totalStats[1].firstChild.textContent = `${t.totalDistance}: `;
    
        // 更新页脚链接
        const footerLinks = document.querySelectorAll(".footer-links a");
        footerLinks[0].textContent = t.termsOfUse;
        footerLinks[1].textContent = t.privacyPolicy;
    
        // 更新模态框标题
        document.querySelector("#wechat-modal h3").textContent = t.wechatQRCode;
    
        // 更新所有路线段
        if (this.travelPlanner && typeof this.travelPlanner.updateRoutes === 'function') {
            this.travelPlanner.updateRoutes();
        }

        // 更新登录/注册相关元素
        const loginBtn = document.getElementById("loginBtn");
        const signupBtn = document.getElementById("signupBtn");
        if (loginBtn) loginBtn.textContent = t.login;
        if (signupBtn) signupBtn.textContent = t.signup;

        // 更新登录模态框
        const loginModal = document.getElementById("login-modal");
        if (loginModal) {
            const modalTitle = loginModal.querySelector("h3");
            if (modalTitle) modalTitle.textContent = t.login;
            
            const loginWithText = loginModal.querySelector(".login-with");
            if (loginWithText) loginWithText.textContent = t.loginWith;
            
            const emailInput = loginModal.querySelector('input[type="email"]');
            if (emailInput) emailInput.placeholder = t.email;
            
            const passwordInput = loginModal.querySelector('input[type="password"]');
            if (passwordInput) passwordInput.placeholder = t.password;
            
            const switchToSignup = loginModal.querySelector("#switch-to-signup");
            if (switchToSignup) switchToSignup.textContent = t.switchToSignup;
        }

        // 更新注册模态框
        const signupModal = document.getElementById("signup-modal");
        if (signupModal) {
            const modalTitle = signupModal.querySelector("h3");
            if (modalTitle) modalTitle.textContent = t.signup;
            
            const signupWithText = signupModal.querySelector(".signup-with");
            if (signupWithText) signupWithText.textContent = t.signupWith;
            
            const usernameInput = signupModal.querySelector('input[name="username"]');
            if (usernameInput) usernameInput.placeholder = t.username;
            
            const emailInput = signupModal.querySelector('input[type="email"]');
            if (emailInput) emailInput.placeholder = t.email;
            
            const passwordInput = signupModal.querySelector('input[name="password"]');
            if (passwordInput) passwordInput.placeholder = t.password;
            
            const confirmPasswordInput = signupModal.querySelector('input[name="confirm-password"]');
            if (confirmPasswordInput) confirmPasswordInput.placeholder = t.confirmPassword;
            
            const switchToLogin = signupModal.querySelector("#switch-to-login");
            if (switchToLogin) switchToLogin.textContent = t.switchToLogin;
        }

        // 更新确认/取消按钮
        const confirmButtons = document.querySelectorAll('.confirm-button');
        const cancelButtons = document.querySelectorAll('.cancel-button');
        confirmButtons.forEach(btn => {
            if (btn) btn.textContent = t.confirm;
        });
        cancelButtons.forEach(btn => {
            if (btn) btn.textContent = t.cancel;
        });
      }

    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // 添加设置当前行程名称的方法
    setCurrentTripName(name) {
        this.currentTripName = name;
        this.updateLanguage();
    }
} 