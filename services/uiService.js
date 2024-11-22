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
    
        // 更新页面标题
        document.title = t.title;
    
        // 更新导航栏
        document.querySelector(".logo").textContent = t.title.split("-")[0].trim();
        const navLinks = document.querySelectorAll("nav ul li a");
        navLinks[0].textContent = t.home;
        navLinks[1].textContent = t.about;
        navLinks[2].textContent = t.contact;
    
        // 更新搜索区域
        this.searchInput.placeholder = t.searchPlaceholder;
        this.addButton.textContent = t.addLocation;
        document.querySelector(".location-hint").textContent = t.locationHint;
    
        // 更新访问顺序面板标题 - 修改这部分
        const visitOrderPanel = document.querySelector(".visit-order-panel h2");
        if (this.currentTripName) {
            visitOrderPanel.textContent = this.currentTripName;
        } else {
            visitOrderPanel.textContent = t.visitOrder;
        }

        // 更新保存的行程下拉菜单标题
        const savedTripsTitle = document.querySelector(".saved-trips-dropdown .dropdown-title");
        if (savedTripsTitle) {
            savedTripsTitle.textContent = t.savedTrips || "Saved Trips"; // 确保translations中有savedTrips的翻译
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