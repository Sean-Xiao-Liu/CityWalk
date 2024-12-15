import { initializeSignupValidation } from "../utils/validators.js";
import { initializeAutocomplete } from './mapService.js';
import { UIService } from './uiService.js';
import { NoteService } from './noteService.js';
// 在页面加载完成后初始化验证
document.addEventListener("DOMContentLoaded", initializeSignupValidation);

class TravelPlanner {
  constructor() {
    // 初始化属性
    this.locations = [];
    this.maps = new Map();
    this.directionsService = new google.maps.DirectionsService();
    this.autocomplete = null;
    this.currentTripName = null;

    // 初始化 NoteService
    this.noteService = new NoteService();
    
    // 将 locations 和 currentTripName 的引用传给 NoteService
    Object.defineProperty(this.noteService, 'locations', {
      get: () => this.locations,
      set: (value) => this.locations = value
    });
    
    Object.defineProperty(this.noteService, 'currentTripName', {
      get: () => this.currentTripName,
      set: (value) => this.currentTripName = value
    });

    // 初始化笔记服务的事件监听器
    this.noteService.initializeEventListeners();

    // DOM 元素
    this.searchInput = document.getElementById("location-search");
    this.addButton = document.getElementById("add-location");
    this.locationsContainer = document.getElementById("locations-container");
    this.visitOrder = document.getElementById("visit-order");
    this.totalTime = document.getElementById("total-time");
    this.totalDistance = document.getElementById("total-distance");

    // 初始化 UI 服务
    this.uiService = new UIService(this);
    
    // 修改初始化方式
    initializeAutocomplete.call(this);
    
    // 其他初始化
    this.initializeSortable();
    this.setupEventListeners();
    this.initializeVisitOrderSortable();
    this.initializeSaveTrip();
    this.loadSavedTrips();
    this.initializeAuth();
    this.summaryMap = null;
    this.summaryDirectionsRenderer = null;
  }

  // 获取当前语言
  getCurrentLanguage() {
    return this.uiService.getCurrentLanguage();
  }

  initializeSortable() {
    new Sortable(this.locationsContainer, {
      animation: 150,
      onEnd: (evt) => {
        // 更新 locations 数组顺序
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;

        // 移动数组元素
        const [movedLocation] = this.locations.splice(oldIndex, 1);
        this.locations.splice(newIndex, 0, movedLocation);

        // 更新路线和显示
        this.updateRoutes();
      },
    });
  }

  setupEventListeners() {
    this.addButton.addEventListener("click", () => this.addLocation());
    this.locationsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove-location")) {
        this.removeLocation(e.target.closest(".route-section"));
      }
    });
  }

  async addLocation(place = null) {
    if (!place) {
      place = this.autocomplete.getPlace();
    }

    if (!place || !place.geometry) {
      alert("请从下拉列表中选择一个有效的地点");
      return;
    }

    this.locations.push({
      name: place.name || place.formatted_address,
      location: place.geometry.location,
      address: place.formatted_address,
    });

    await this.updateRoutes();
    this.searchInput.value = "";

    // 如果当前是已保存的行程，更新 localStorage
    if (this.currentTripName) {
      let savedTrips = JSON.parse(localStorage.getItem("savedTrips") || "[]");
      const tripIndex = savedTrips.findIndex(
        (trip) => trip.name === this.currentTripName
      );
      if (tripIndex !== -1) {
        savedTrips[tripIndex].locations = this.locations;
        localStorage.setItem("savedTrips", JSON.stringify(savedTrips));

        // 可选：更新保存的行程列表显示
        this.updateSavedTripsList();
      }
    }
  }

  removeLocation(routeSection) {
    const index = Array.from(this.locationsContainer.children).indexOf(
      routeSection
    );
    if (index !== -1) {
      this.locations.splice(index, 1);
      routeSection.remove();
      this.updateRoutes();
    }
  }

  async updateRoutes() {
    // 检查是否有当前行程名称
    const visitOrderPanel = document.querySelector(".visit-order-panel h2");
    if (this.currentTripName) {
      visitOrderPanel.textContent = this.currentTripName;
    } else {
      visitOrderPanel.textContent =
        translations[this.getCurrentLanguage()].visitOrder;
    }

    // 清空现有路线
    this.locationsContainer.innerHTML = "";
    this.maps.clear();

    if (this.locations.length < 2) {
      // 清空总结信息
      this.totalTime.textContent = translations[
        this.getCurrentLanguage()
      ].minutes.replace("%s", "0");
      this.totalDistance.textContent = translations[
        this.getCurrentLanguage()
      ].kilometers.replace("%s", "0");

      // 更新访问顺序面板
      this.updateVisitOrder();

      // 如果只有一个地点，显示单个地点
      if (this.locations.length === 1) {
        const location = this.locations[0];
        const singleLocationElement =
          this.createSingleLocationSection(location);
        this.locationsContainer.appendChild(singleLocationElement);
      }
      return;
    }

    let totalTime = 0;
    let totalDistance = 0;

    // 创建路线段
    for (let i = 0; i < this.locations.length - 1; i++) {
      const start = this.locations[i];
      const end = this.locations[i + 1];

      const routeSection = this.createRouteSection(start, end);
      this.locationsContainer.appendChild(routeSection);

      // 增加延迟确保 DOM 完全更新
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const result = await this.calculateRoute(start.location, end.location);
        const route = result.routes[0];

        // 更新统计信息
        const duration = route.legs[0].duration.value;
        const distance = route.legs[0].distance.value;
        totalTime += duration;
        totalDistance += distance;

        // 将秒转换为小时和分钟
        const durationHours = Math.floor(duration / 3600);
        const durationMinutes = Math.round((duration % 3600) / 60);

        // 根据语言格式化时间显示
        let timeDisplay;
        if (this.getCurrentLanguage() === "zh") {
          timeDisplay = `${durationHours} 小时 ${durationMinutes} 分钟`;
        } else {
          timeDisplay = `${durationHours}h ${durationMinutes}m`;
        }

        // 更新路线段信息
        routeSection.querySelector(".travel-time").textContent = timeDisplay;
        routeSection.querySelector(".distance").textContent = `${(
          distance / 1000
        ).toFixed(1)} km (${(distance / 1609.34).toFixed(1)} mi)`;

        // 初始化地图
        const mapElement = routeSection.querySelector(".route-map");
        if (mapElement) {
          mapElement.style.width = "100%";
          mapElement.style.height = "360px";

          const map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: start.location,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "cooperative",
          });

          const directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: false,
            draggable: false,
          });

          directionsRenderer.setDirections(result);
          this.maps.set(routeSection, map);

          // 触发resize事件
          google.maps.event.trigger(map, "resize");
        }
      } catch (error) {
        console.error("Route calculation error:", error);
        const t = translations[this.getCurrentLanguage()];
        routeSection.querySelector(".travel-time").textContent = t.calculating;
        routeSection.querySelector(".distance").textContent = t.calculating;
      }
    }

    // 更新总计时间和距离
    const totalHours = Math.floor(totalTime / 3600);
    const totalMinutes = Math.round((totalTime % 3600) / 60);
    let timeDisplay;

    if (this.getCurrentLanguage() === "zh") {
      timeDisplay = `${totalHours} 小时 ${totalMinutes} 分钟`;
    } else {
      timeDisplay = `${totalHours}h ${totalMinutes}m`;
    }

    // 确保元素存在后再更新内容
    if (this.totalTime) {
      this.totalTime.textContent = timeDisplay;
    }
    
    if (this.totalDistance) {
      this.totalDistance.textContent = `${(totalDistance / 1000).toFixed(1)} km (${(totalDistance / 1609.34).toFixed(1)} mi)`;
    }

    // 更新访问顺序面板
    this.updateVisitOrder();

    // 初始化总览地图（如果还没有初始化）
    if (!this.summaryMap) {
      this.initializeSummaryMap();
    }

    // 更新总览地图
    if (this.locations.length >= 2) {
      try {
        const waypoints = this.locations.slice(1, -1).map(loc => ({
          location: loc.location,
          stopover: true
        }));

        const result = await this.directionsService.route({
          origin: this.locations[0].location,
          destination: this.locations[this.locations.length - 1].location,
          waypoints: waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false
        });

        this.summaryDirectionsRenderer.setDirections(result);
        
        // 调整地图视野以显示所有路线
        const bounds = new google.maps.LatLngBounds();
        this.locations.forEach(loc => {
          bounds.extend(loc.location);
        });
        this.summaryMap.fitBounds(bounds);

      } catch (error) {
        console.error("Summary route calculation error:", error);
      }
    } else if (this.locations.length === 1) {
      // 如果只有一个地点，显示单个标记
      this.summaryDirectionsRenderer.setMap(null);
      const marker = new google.maps.Marker({
        position: this.locations[0].location,
        map: this.summaryMap,
        title: this.locations[0].name
      });
      this.summaryMap.setCenter(this.locations[0].location);
      this.summaryMap.setZoom(15);
    } else {
      // 如果没有地点，清除地图
      this.summaryDirectionsRenderer.setMap(null);
      this.summaryMap.setCenter({ lat: 0, lng: 0 });
      this.summaryMap.setZoom(2);
    }
  }

  createRouteSection(start, end) {
    const t = translations[this.getCurrentLanguage()];
    const template = `
        <div class="route-section">
            <div class="route-info">
                <div class="route-number">${t.route} ${this.locations.indexOf(start) + 1}</div>
                <div class="location-details">
                    <div class="start-location">
                        <h4>${t.startPoint}</h4>
                        <p class="location-name">${start.name}</p>
                        <p class="location-address">${start.address || ""}</p>
                    </div>
                    <div class="end-location">
                        <h4>${t.endPoint}</h4>
                        <p class="location-name">${end.name}</p>
                        <p class="location-address">${end.address || ""}</p>
                    </div>
                    <div class="route-stats">
                        <p>${t.travelTime}: <span class="travel-time">${t.calculating}</span></p>
                        <p>${t.distance}: <span class="distance">${t.calculating}</span></p>
                    </div>
                </div>
            </div>
            <div class="map-container">
                <div class="route-map"></div>
            </div>
        </div>
    `;
    const div = document.createElement("div");
    div.innerHTML = template.trim();
    return div.firstChild;
  }

  calculateRoute(start, end) {
    return new Promise((resolve, reject) => {
      this.directionsService.route(
        {
          origin: start,
          destination: end,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") {
            resolve(result);
          } else {
            reject(status);
          }
        }
      );
    });
  }

  // 修改单个地点显示方法
  createSingleLocationSection(location) {
    const t = translations[this.getCurrentLanguage()];
    const template = `
        <div class="route-section">
            <div class="route-info">
                <div class="route-number">${t.route} 1</div>
                <div class="location-details">
                    <div class="start-location">
                        <h4>${t.startPoint}</h4>
                        <p class="location-name">${location.name}</p>
                        <p class="location-address">${location.address || ""}</p>
                    </div>
                </div>
            </div>
            <div class="map-container">
                <div class="route-map"></div>
            </div>
        </div>
    `;
    const div = document.createElement("div");
    div.innerHTML = template.trim();
    const element = div.firstChild;

    // 迟初始化地图
    setTimeout(() => {
      const mapElement = element.querySelector(".route-map");
      if (mapElement) {
        mapElement.style.width = "100%";
        mapElement.style.height = "360px";

        const map = new google.maps.Map(mapElement, {
          center: location.location,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });

        new google.maps.Marker({
          position: location.location,
          map: map,
          title: location.name,
        });

        google.maps.event.trigger(map, "resize");
      }
    }, 100);

    return element;
  }

  initializeVisitOrderSortable() {
    new Sortable(document.getElementById("visit-order"), {
      animation: 150,
      group: "locations",
      onEnd: (evt) => {
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;

        // 新locations数组顺序
        const [movedLocation] = this.locations.splice(oldIndex, 1);
        this.locations.splice(newIndex, 0, movedLocation);

        // 更新路
        this.updateRoutes();
      },
    });
  }

  updateVisitOrder() {
    const visitOrderList = document.getElementById("visit-order");
    visitOrderList.innerHTML = "";

    this.locations.forEach((location, index) => {
      const orderItem = document.createElement("div");
      orderItem.className = "visit-order-item";
      orderItem.innerHTML = `
                <div class="location-number">${index + 1}</div>
                <div class="location-info">
                    <div class="location-name">${location.name}</div>
                    <div class="location-address">${
                      location.address || ""
                    }</div>
                </div>
                <div class="icons-container">
                    <button class="edit-location" data-index="${index}" title="Edit location">
                        <svg class="edit-icon" viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="delete-location" data-index="${index}" title="Delete location">
                        <svg class="delete-icon" viewBox="0 0 24 24">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                    </button>
                </div>
            `;

      // 添加点击事件处理
      this.setupVisitOrderItemEvents(orderItem, index);
      visitOrderList.appendChild(orderItem);
    });
  }

  setupVisitOrderItemEvents(orderItem, index) {
    // 使用箭头函数来保持 this 的上下文
    orderItem.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        const routeSections = document.querySelectorAll(".route-section");
        if (routeSections[index]) {
          routeSections[index].scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }
    });

    // 修改编辑按钮的事件监听器 - 使用箭头函数
    const editBtn = orderItem.querySelector(".edit-location");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log("Edit button clicked for location", index);
      console.log("noteService:", this.noteService); // 调试日志
      this.noteService.openNoteEditor(index);
    });

    // 设置删除按钮事件
    const deleteBtn = orderItem.querySelector(".delete-location");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const location = this.locations[index];
      const notesCount = location.notes ? location.notes.length : 0;

      // 如果地点有笔记，显示确认对话框
      if (notesCount > 0) {
        const deleteModal = document.getElementById("delete-location-modal");
        const message = deleteModal.querySelector(".delete-message");
        const confirmBtn = document.getElementById("confirm-delete-location");
        const cancelBtn = document.getElementById("cancel-delete-location");

        const t = translations[this.getCurrentLanguage()];
        message.textContent = t.deleteLocationConfirm.replace('%s', notesCount);

        deleteModal.style.display = "block";
        document.body.style.overflow = "hidden";

        const closeModal = () => {
          deleteModal.style.display = "none";
          document.body.style.overflow = "";
        };

        // 清除之前的事件监听器
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newConfirmBtn = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newCancelBtn.onclick = closeModal;
        newConfirmBtn.onclick = () => {
          this.removeLocation(index);
          closeModal();
        };

        // 点击模态框外部关闭
        deleteModal.onclick = (e) => {
          if (e.target === deleteModal) {
            closeModal();
          }
        };

        // ESC 键关闭
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && deleteModal.style.display === "block") {
            closeModal();
          }
        });
      } else {
        // 如果没有笔记，直接删除
        this.removeLocation(index);
      }
    });
  }

  removeLocation(index) {
    this.locations.splice(index, 1);
    this.updateRoutes();

    // 如果当前是已保存的行程，更新 localStorage
    if (this.currentTripName) {
      let savedTrips = JSON.parse(localStorage.getItem("savedTrips") || "[]");
      const tripIndex = savedTrips.findIndex(
        (trip) => trip.name === this.currentTripName
      );
      if (tripIndex !== -1) {
        savedTrips[tripIndex].locations = this.locations;
        localStorage.setItem("savedTrips", JSON.stringify(savedTrips));
      }
    }
  }

  initializeSaveTrip() {
    const saveBtn = document.getElementById("save-trip");
    const modal = document.getElementById("save-trip-modal");
    const closeBtn = modal.querySelector(".close-modal");
    const confirmBtn = document.getElementById("confirm-save-trip");
    const tripNameInput = document.getElementById("trip-name");

    saveBtn.addEventListener("click", () => {
      modal.style.display = "block";
      document.body.style.overflow = "hidden";
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
      tripNameInput.value = "";
    });

    confirmBtn.addEventListener("click", () => {
      const tripName = tripNameInput.value.trim();
      if (tripName) {
        this.saveTrip(tripName);
        modal.style.display = "none";
        document.body.style.overflow = "";
        tripNameInput.value = "";
      }
    });
  }

  saveTrip(name) {
    // 确保每个地点的笔记都被正确保存
    const trip = {
      name,
      locations: this.locations.map((location) => ({
        name: location.name,
        location: location.location,
        address: location.address,
        notes: location.notes || [], // 确保包含笔记数组
        savedTripId: location.savedTripId,
      })),
      date: new Date().toISOString(),
    };

    let savedTrips = JSON.parse(localStorage.getItem("savedTrips") || "[]");
    savedTrips.push(trip);
    localStorage.setItem("savedTrips", JSON.stringify(savedTrips));

    this.updateSavedTripsList();
  }

  loadSavedTrips() {
    this.updateSavedTripsList();
  }

  updateSavedTripsList() {
    const savedTrips = JSON.parse(localStorage.getItem("savedTrips") || "[]");
    const tripsList = document.getElementById("saved-trips-list");
    const t = translations[this.getCurrentLanguage()];

    if (savedTrips.length === 0) {
      tripsList.innerHTML = `<a href="#" class="no-trips">${t.noSavedTrips}</a>`;
      return;
    }

    tripsList.innerHTML = savedTrips
      .map(
        (trip, index) => `
            <a href="#" class="saved-trip" data-index="${index}">
                <span>${trip.name}</span>
                <div class="trip-actions">
                    <button class="edit-trip" data-index="${index}" title="Edit trip name">
                        <svg class="edit-icon" viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="delete-trip" data-index="${index}" title="Delete trip">
                        <svg class="delete-icon" viewBox="0 0 24 24">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                    </button>
                </div>
            </a>
        `
      )
      .join("");

    // 添加编辑按钮事件监听
    tripsList.querySelectorAll(".edit-trip").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const trip = savedTrips[index];

        // 显示保存行程模态框用于编辑
        const modal = document.getElementById("save-trip-modal");
        const input = document.getElementById("trip-name");
        const confirmBtn = document.getElementById("confirm-save-trip");

        // 设置标题和按钮文本
        modal.querySelector("h3").textContent = "Edit Trip Name";
        confirmBtn.textContent = "Update";

        // 填充当前名称
        input.value = trip.name;

        // 显示模态框
        modal.style.display = "block";
        input.focus();

        // 处理更新
        const handleUpdate = () => {
          const newName = input.value.trim();
          if (newName) {
            savedTrips[index].name = newName;
            localStorage.setItem("savedTrips", JSON.stringify(savedTrips));
            this.updateSavedTripsList();
            modal.style.display = "none";

            // 重置模态框
            modal.querySelector("h3").textContent = "Save Your Trip";
            confirmBtn.textContent = "Save";
            input.value = "";
          }
        };

        // 更新确认按钮事件
        confirmBtn.onclick = handleUpdate;

        // 处理回车键
        input.onkeypress = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleUpdate();
          }
        };
      });
    });

    // 修改删除按钮的事件监听
    tripsList.querySelectorAll(".delete-trip").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); // 阻止链接的默认行为
        e.stopPropagation(); // 阻止事件冒泡

        const index = parseInt(btn.dataset.index);
        const tripName = savedTrips[index].name;

        // 显示删除确认模态框
        const deleteModal = document.getElementById("delete-trip-modal");
        const message = deleteModal.querySelector(".delete-message");
        const confirmBtn = document.getElementById("confirm-delete-trip");
        const cancelBtn = document.getElementById("cancel-delete-trip");

        message.textContent = `Are you sure you want to delete "${tripName}"?`;
        deleteModal.style.display = "block";

        // 处理取消按钮
        const closeModal = () => {
          deleteModal.style.display = "none";
        };

        // 清除之前的事件监听器
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newConfirmBtn = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        // 添加新的事件监听器
        newCancelBtn.onclick = closeModal;
        newConfirmBtn.onclick = () => {
          this.deleteTrip(index);
          closeModal();
        };

        // 处理点击模态框外部关闭
        deleteModal.onclick = (e) => {
          if (e.target === deleteModal) {
            closeModal();
          }
        };
      });
    });

    // 处理行程点击事件
    tripsList.querySelectorAll(".saved-trip").forEach((link) => {
      link.addEventListener("click", (e) => {
        if (
          !e.target.closest(".delete-trip") &&
          !e.target.closest(".edit-trip")
        ) {
          e.preventDefault();
          const index = parseInt(e.target.closest(".saved-trip").dataset.index);
          const savedTrips = JSON.parse(
            localStorage.getItem("savedTrips") || "[]"
          );
          this.loadTrip(savedTrips[index]);
        }
      });
    });
  }

  loadTrip(trip) {
    // 清空当前路线
    this.locations = [];

    // 保存行程名称并更新UI
    this.currentTripName = trip.name;
    this.uiService.setCurrentTripName(trip.name);

    // 深拷贝行程数据
    this.locations = trip.locations.map((location) => ({
      name: location.name,
      location: location.location,
      address: location.address,
      notes: location.notes || [],
      savedTripId: location.savedTripId,
    }));

    // 清空搜索框
    this.searchInput.value = "";

    // 更新路线和显示
    this.updateRoutes();
    this.updateVisitOrder(); // 确保更新访问顺序卡片
  }

  deleteTrip(index) {
    let savedTrips = JSON.parse(localStorage.getItem("savedTrips") || "[]");
    savedTrips.splice(index, 1);
    localStorage.setItem("savedTrips", JSON.stringify(savedTrips));
    this.updateSavedTripsList();
  }

  initializeAuth() {
    // 初始化 Firebase
    const firebaseConfig = {
      // 你的 Firebase 配置
      apiKey: "YOUR_API_KEY",
      authDomain: "your-app.firebaseapp.com",
      projectId: "your-project-id",
      // ... 其他配置
    };
    firebase.initializeApp(firebaseConfig);

    // 初始化登录模态框
    const loginBtn = document.getElementById("login-btn");
    const loginModal = document.getElementById("login-modal");
    const closeBtn = loginModal.querySelector(".close-modal");
    const googleLoginBtn = document.getElementById("google-login");
    const appleLoginBtn = document.getElementById("apple-login");
    const userProfile = document.querySelector(".user-profile");
    const logoutBtn = document.getElementById("logout-btn");

    // 检查登录状态
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // 用户已登录
        document.getElementById("login-btn").classList.add("hidden");
        userProfile.classList.remove("hidden");
        document.getElementById("user-avatar").src =
          user.photoURL || "default-avatar.png";
        document.getElementById("user-name").textContent = user.displayName;
      } else {
        // 用户未登录
        document.getElementById("login-btn").classList.remove("hidden");
        userProfile.classList.add("hidden");
      }
    });

    // 登录按钮点击事件
    loginBtn.addEventListener("click", () => {
      loginModal.style.display = "block";
      document.body.style.overflow = "hidden";
    });

    // 关闭模态框
    closeBtn.addEventListener("click", () => {
      loginModal.style.display = "none";
      document.body.style.overflow = "";
    });

    // Google 登录
    googleLoginBtn.addEventListener("click", async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        await firebase.auth().signInWithPopup(provider);
        loginModal.style.display = "none";
        document.body.style.overflow = "";
      } catch (error) {
        console.error("Google login error:", error);
      }
    });

    // Apple 登录
    appleLoginBtn.addEventListener("click", async () => {
      const provider = new firebase.auth.OAuthProvider("apple.com");
      try {
        await firebase.auth().signInWithPopup(provider);
        loginModal.style.display = "none";
        document.body.style.overflow = "";
      } catch (error) {
        console.error("Apple login error:", error);
      }
    });

    // 登出
    logoutBtn.addEventListener("click", async () => {
      try {
        await firebase.auth().signOut();
      } catch (error) {
        console.error("Logout error:", error);
      }
    });

    // 添加注册相关的事件监听
    const signupBtn = document.getElementById("signupBtn");
    const signupModal = document.getElementById("signup-modal");
    const switchToLogin = document.getElementById("switch-to-login");

    // 打开注册模态框
    signupBtn.addEventListener("click", () => {
      signupModal.style.display = "block";
      document.body.style.overflow = "hidden";
    });

    // 关闭注册模态框
    signupModal.querySelector(".close-modal").addEventListener("click", () => {
      signupModal.style.display = "none";
      document.body.style.overflow = "";
    });

    // 切换到登录模态框
    switchToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      signupModal.style.display = "none";
      document.getElementById("login-modal").style.display = "block";
    });

    // 处理注册表单提交
    document
      .querySelector(".signup-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get("email");
        const password = formData.get("password");
        const confirmPassword = formData.get("confirm-password");

        if (password !== confirmPassword) {
          alert("Passwords do not match");
          return;
        }

        try {
          const userCredential = await firebase
            .auth()
            .createUserWithEmailAndPassword(email, password);
          const user = userCredential.user;

          // 更新用户信息
          await user.updateProfile({
            displayName: formData.get("username"),
          });

          // 关闭模态框
          signupModal.style.display = "none";
          document.body.style.overflow = "";

          // 可以添加注册成功的提示
          alert("Registration successful!");
        } catch (error) {
          console.error("Signup error:", error);
          alert(error.message);
        }
      });

    // 处理交账号注册
    document
      .getElementById("google-signup")
      .addEventListener("click", async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
          await firebase.auth().signInWithPopup(provider);
          signupModal.style.display = "none";
          document.body.style.overflow = "";
        } catch (error) {
          console.error("Google signup error:", error);
          alert(error.message);
        }
      });

    document
      .getElementById("apple-signup")
      .addEventListener("click", async () => {
        const provider = new firebase.auth.OAuthProvider("apple.com");
        try {
          await firebase.auth().signInWithPopup(provider);
          signupModal.style.display = "none";
          document.body.style.overflow = "";
        } catch (error) {
          console.error("Apple signup error:", error);
          alert(error.message);
        }
      });
  }

  // 修改打开编辑器的方法
  openNoteEditor(locationIndex) {
    this.noteService.openNoteEditor(locationIndex);
  }

  // 添加初始化总览地图的方法
  initializeSummaryMap() {
    const mapElement = document.getElementById('summary-map');
    if (!mapElement) return;

    this.summaryMap = new google.maps.Map(mapElement, {
      zoom: 12,
      center: { lat: 0, lng: 0 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "cooperative",
    });

    this.summaryDirectionsRenderer = new google.maps.DirectionsRenderer({
      map: this.summaryMap,
      suppressMarkers: false,
      draggable: false,
    });
  }
}

// 修改初始化方式
window.initializeTravelPlanner = function() {
    if (typeof google === "undefined") {
        console.error("Google Maps API is not loaded correctly");
        return;
    }
    window.travelPlanner = new TravelPlanner();
}

// 确保在 DOM 加载完成后再初始化
document.addEventListener("DOMContentLoaded", () => {
    if (typeof google !== "undefined") {
        window.initializeTravelPlanner();
    }
});

// 添加登录按钮点击事件
document.getElementById("loginBtn").addEventListener("click", function () {
  document.getElementById("login-modal").style.display = "block";
});

// 关闭模态框
document
  .querySelector("#login-modal .close-modal")
  .addEventListener("click", function () {
    document.getElementById("login-modal").style.display = "none";
  });

// 点击模态框外部关闭
window.addEventListener("click", function (event) {
  if (event.target == document.getElementById("login-modal")) {
    document.getElementById("login-modal").style.display = "none";
  }
});

// 处理登录表单提交
document.querySelector(".login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  // 这里添加登录逻辑
  console.log("登录表单交");
});

// 处理社交登录按钮点击
document.getElementById("google-login").addEventListener("click", function () {
  // 添加 Google 登录逻辑
  console.log("Google 登录");
});

document.getElementById("apple-login").addEventListener("click", function () {
  // 添加 Apple 登录逻辑
  console.log("Apple 登录");
});

// 添加注册按钮点击事件
document.getElementById("signupBtn").addEventListener("click", function () {
  document.getElementById("signup-modal").style.display = "block";
});

// 关闭注册模态框
document
  .querySelector("#signup-modal .close-modal")
  .addEventListener("click", function () {
    document.getElementById("signup-modal").style.display = "none";
  });

// 点击模态框外部关闭
window.addEventListener("click", function (event) {
  if (event.target == document.getElementById("signup-modal")) {
    document.getElementById("signup-modal").style.display = "none";
  }
});

// 切换到登录模态框
document
  .getElementById("switch-to-login")
  .addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("signup-modal").style.display = "none";
    document.getElementById("login-modal").style.display = "block";
  });

