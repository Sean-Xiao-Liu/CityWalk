class TravelPlanner {
    constructor() {
        // 初始化属性
        this.locations = [];
        this.maps = new Map();
        this.directionsService = new google.maps.DirectionsService();
        this.autocomplete = null;
        
        // DOM 元素
        this.searchInput = document.getElementById('location-search');
        this.addButton = document.getElementById('add-location');
        this.locationsContainer = document.getElementById('locations-container');
        this.visitOrder = document.getElementById('visit-order');
        this.totalTime = document.getElementById('total-time');
        this.totalDistance = document.getElementById('total-distance');
        
        // 初始化
        this.initializeAutocomplete();
        this.initializeSortable();
        this.setupEventListeners();
        this.currentLanguage = 'en';
        this.initializeLanguageSelector();
        this.initializeVisitOrderSortable();
        this.initializeWeChatModal();
        this.initializeSaveTrip();
        this.loadSavedTrips();
        this.initializeAuth();
    }

    initializeAutocomplete() {
        // 首先建基本的自动完成对象
        this.autocomplete = new google.maps.places.Autocomplete(this.searchInput, {
            types: ['establishment', 'geocode'],
            fields: ['name', 'geometry', 'formatted_address', 'place_id']
        });

        // 获取用户位置并更新搜索偏好
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = new google.maps.LatLng(
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    // 创建一个以用户位置为中心的边界
                    const bounds = new google.maps.LatLngBounds(
                        new google.maps.LatLng(
                            position.coords.latitude - 0.5,  // 向南扩展约50公里
                            position.coords.longitude - 0.5  // 向西扩展约50公里
                        ),
                        new google.maps.LatLng(
                            position.coords.latitude + 0.5,  // 向北扩展约50公里
                            position.coords.longitude + 0.5  // 向东扩展约50公里
                        )
                    );

                    // 更新自动完成的搜索偏好
                    this.autocomplete.setBounds(bounds);
                    
                    // 可选：添加一个圆形区来显示搜索范围
                    new google.maps.Circle({
                        center: userLocation,
                        radius: 50000  // 50公里半径
                    }).setBounds(bounds);
                },
                (error) => {
                    console.warn('无法获取用户位置:', error);
                    // 如果无法获取位置，使用默认的美国范围
                    const defaultBounds = new google.maps.LatLngBounds(
                        new google.maps.LatLng(25.82, -124.39),  // 美国西南角
                        new google.maps.LatLng(49.38, -66.94)    // 美国东北角
                    );
                    this.autocomplete.setBounds(defaultBounds);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }

        this.autocomplete.addListener('place_changed', () => {
            const place = this.autocomplete.getPlace();
            if (place && place.geometry) {
                this.addLocation(place);
            }
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
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
            }
        });
    }

    setupEventListeners() {
        this.addButton.addEventListener('click', () => this.addLocation());
        this.locationsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-location')) {
                this.removeLocation(e.target.closest('.route-section'));
            }
        });
    }

    async addLocation(place = null) {
        if (!place) {
            place = this.autocomplete.getPlace();
        }

        if (!place || !place.geometry) {
            alert('请从下拉列表中选择一个有效的地点');
            return;
        }

        this.locations.push({
            name: place.name || place.formatted_address,
            location: place.geometry.location,
            address: place.formatted_address
        });

        await this.updateRoutes();
        this.searchInput.value = '';
    }

    removeLocation(routeSection) {
        const index = Array.from(this.locationsContainer.children).indexOf(routeSection);
        if (index !== -1) {
            this.locations.splice(index, 1);
            routeSection.remove();
            this.updateRoutes();
        }
    }

    async updateRoutes() {
        // 检查是否有当前行程名称
        const visitOrderPanel = document.querySelector('.visit-order-panel h2');
        if (this.currentTripName) {
            visitOrderPanel.textContent = this.currentTripName;
        } else {
            visitOrderPanel.textContent = translations[this.currentLanguage].visitOrder;
        }
        
        // 清空现有路线
        this.locationsContainer.innerHTML = '';
        this.maps.clear();

        if (this.locations.length < 2) {
            // 清空总结信息
            this.totalTime.textContent = translations[this.currentLanguage].minutes.replace('%s', '0');
            this.totalDistance.textContent = translations[this.currentLanguage].kilometers.replace('%s', '0');
            
            // 更新访问顺序面板 - 修改这部分
            this.updateVisitOrder();  // 使用统一的方法更新访问顺序
            
            // 如果只有一个地点，显示单个地点
            if (this.locations.length === 1) {
                const location = this.locations[0];
                const singleLocationElement = this.createSingleLocationSection(location);
                this.locationsContainer.appendChild(singleLocationElement);
            }
            return;
        }

        let totalTime = 0;
        let totalDistance = 0;
        this.visitOrder.innerHTML = '';

        // 更新访问顺序列表
        this.locations.forEach((location, index) => {
            const li = document.createElement('li');
            li.textContent = location.name;
            this.visitOrder.appendChild(li);
        });

        // 创建路线段
        for (let i = 0; i < this.locations.length - 1; i++) {
            const start = this.locations[i];
            const end = this.locations[i + 1];
            
            const routeSection = this.createRouteSection(start, end);
            this.locationsContainer.appendChild(routeSection);

            // 增加延迟确保 DOM 完全更新
            await new Promise(resolve => setTimeout(resolve, 100));

            try {
                const result = await this.calculateRoute(start.location, end.location);
                const route = result.routes[0];
                
                // 更新统计信息
                const duration = route.legs[0].duration.value;
                const distance = route.legs[0].distance.value;
                totalTime += duration;
                totalDistance += distance;

                // 更新路线段信息
                const t = translations[this.currentLanguage];
                routeSection.querySelector('.travel-time').textContent = 
                    Math.round(duration / 60) + ' ' + t.minutes;
                routeSection.querySelector('.distance').textContent = 
                    (distance / 1000).toFixed(1) + ' ' + t.kilometers;

                // 修改地图初始化方式
                const mapElement = routeSection.querySelector('.route-map');
                if (mapElement) {
                    // 确保地图容器有尺寸
                    mapElement.style.width = '100%';
                    mapElement.style.height = '300px';

                    const map = new google.maps.Map(mapElement, {
                        zoom: 12,
                        center: start.location,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                        gestureHandling: 'cooperative'
                    });

                    // 等待地图加载完成
                    await new Promise(resolve => {
                        google.maps.event.addListenerOnce(map, 'idle', resolve);
                    });

                    const directionsRenderer = new google.maps.DirectionsRenderer({
                        map: map,
                        suppressMarkers: false,
                        draggable: false
                    });
                    
                    directionsRenderer.setDirections(result);
                    this.maps.set(routeSection, map);

                    // 触发resize事件
                    google.maps.event.trigger(map, 'resize');
                }
            } catch (error) {
                console.error('Route calculation error:', error);
                console.error('Start location:', start.location);
                console.error('End location:', end.location);
                const t = translations[this.currentLanguage];
                routeSection.querySelector('.travel-time').textContent = t.calculating;
                routeSection.querySelector('.distance').textContent = t.calculating;
            }
        }

        // 更新总计
        const t = translations[this.currentLanguage];
        this.totalTime.textContent = Math.round(totalTime / 60) + ' ' + t.minutes;
        this.totalDistance.textContent = (totalDistance / 1000).toFixed(1) + ' ' + t.kilometers;

        // 在更新路线后更新访问顺序面板
        this.updateVisitOrder();
    }

    createRouteSection(start, end) {
        const t = translations[this.currentLanguage];
        const template = `
            <div class="route-section" draggable="true">
                <div class="route-number">${t.route} ${this.locations.indexOf(start) + 1}</div>
                <div class="route-info">
                    <div class="location-details">
                        <div class="start-location">
                            <h4>${t.startPoint}</h4>
                            <p class="location-name">${start.name}</p>
                            <p class="location-address">${start.address || ''}</p>
                        </div>
                        <div class="end-location">
                            <h4>${t.endPoint}</h4>
                            <p class="location-name">${end.name}</p>
                            <p class="location-address">${end.address || ''}</p>
                        </div>
                    </div>
                    <div class="route-stats">
                        <p>${t.travelTime}: <span class="travel-time">${t.calculating}</span></p>
                        <p>${t.distance}: <span class="distance">${t.calculating}</span></p>
                    </div>
                </div>
                <div class="map-container">
                    <div class="route-map"></div>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = template.trim();
        return div.firstChild;
    }

    calculateRoute(start, end) {
        return new Promise((resolve, reject) => {
            this.directionsService.route({
                origin: start,
                destination: end,
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                if (status === 'OK') {
                    resolve(result);
                } else {
                    reject(status);
                }
            });
        });
    }

    // 修改单个地点显示方法
    createSingleLocationSection(location) {
        const t = translations[this.currentLanguage];
        const template = `
            <div class="route-section" draggable="true">
                <div class="route-number">Route 1</div>
                <div class="route-info">
                    <div class="location-details">
                        <div class="start-location">
                            <h4>${t.startPoint}</h4>
                            <p class="location-name">${location.name}</p>
                            <p class="location-address">${location.address || ''}</p>
                        </div>
                    </div>
                </div>
                <div class="map-container">
                    <div class="route-map"></div>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = template.trim();
        const element = div.firstChild;
        
        // 迟初始化地图
        setTimeout(() => {
            const mapElement = element.querySelector('.route-map');
            if (mapElement) {
                mapElement.style.width = '100%';
                mapElement.style.height = '300px';
                
                const map = new google.maps.Map(mapElement, {
                    center: location.location,
                    zoom: 15,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    gestureHandling: 'cooperative'
                });

                new google.maps.Marker({
                    position: location.location,
                    map: map,
                    title: location.name
                });

                google.maps.event.trigger(map, 'resize');
            }
        }, 100);
        
        return element;
    }

    initializeLanguageSelector() {
        const languageSelect = document.getElementById('language-select');
        const languageSelector = document.querySelector('.language-selector');
        
        // 设置初始图标
        languageSelector.setAttribute('data-selected', languageSelect.value);
        
        languageSelect.addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
            // 更新国旗图标
            languageSelector.setAttribute('data-selected', e.target.value);
            this.updateLanguage();
        });
    }

    updateLanguage() {
        const t = translations[this.currentLanguage];
        
        // 更新页面标题
        document.title = t.title;
        
        // 更新导航栏
        document.querySelector('.logo').textContent = t.title.split('-')[0].trim();
        const navLinks = document.querySelectorAll('nav ul li a');
        navLinks[0].textContent = t.home;
        navLinks[1].textContent = t.about;
        navLinks[2].textContent = t.contact;
        
        // 更新搜索区域
        this.searchInput.placeholder = t.searchPlaceholder;
        this.addButton.textContent = t.addLocation;
        document.querySelector('.location-hint').textContent = t.locationHint;
        
        // 更顺
        document.querySelector('.visit-order-panel h2').textContent = t.visitOrder;
        
        // 更新总结区域
        document.querySelector('.summary-section h2').textContent = t.tripSummary;
        const totalStats = document.querySelector('.total-stats').children;
        totalStats[0].firstChild.textContent = `${t.totalTime}: `;
        totalStats[1].firstChild.textContent = `${t.totalDistance}: `;
        
        // 更新页脚链接
        const footerLinks = document.querySelectorAll('.footer-links a');
        footerLinks[0].textContent = t.termsOfUse;
        footerLinks[1].textContent = t.privacyPolicy;
        
        // 更新模态框标题
        document.querySelector('#wechat-modal h3').textContent = t.wechatQRCode;
        
        // 更新所有路线段
        this.updateRoutes();
    }

    initializeVisitOrderSortable() {
        new Sortable(document.getElementById('visit-order'), {
            animation: 150,
            group: 'locations',
            onEnd: (evt) => {
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;
                
                // 更新locations数组顺序
                const [movedLocation] = this.locations.splice(oldIndex, 1);
                this.locations.splice(newIndex, 0, movedLocation);
                
                // 更新路线
                this.updateRoutes();
            }
        });
    }

    updateVisitOrder() {
        const visitOrderList = document.getElementById('visit-order');
        visitOrderList.innerHTML = '';
        
        this.locations.forEach((location, index) => {
            const orderItem = document.createElement('div');
            orderItem.className = 'visit-order-item';
            orderItem.innerHTML = `
                <div class="location-number">${index + 1}</div>
                <div class="location-info">
                    <div class="location-name">${location.name}</div>
                    <div class="location-address">${location.address || ''}</div>
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
            
            // 添加删除按钮事件监听
            const deleteBtn = orderItem.querySelector('.delete-location');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.closest('.delete-location').dataset.index);
                const location = this.locations[index];
                const notesCount = location.notes ? location.notes.length : 0;

                // 如果地点有笔记，显示确认对话框
                if (notesCount > 0) {
                    const deleteModal = document.getElementById('delete-location-modal');
                    const message = deleteModal.querySelector('.delete-message');
                    const confirmBtn = document.getElementById('confirm-delete-location');
                    const cancelBtn = document.getElementById('cancel-delete-location');
                    
                    message.textContent = `This location contains ${notesCount} note${notesCount > 1 ? 's' : ''}. Are you sure you want to delete it?`;
                    
                    deleteModal.style.display = 'block';
                    document.body.style.overflow = 'hidden';

                    const closeModal = () => {
                        deleteModal.style.display = 'none';
                        document.body.style.overflow = '';
                    };

                    cancelBtn.onclick = closeModal;
                    deleteModal.querySelector('.close-modal').onclick = closeModal;

                    confirmBtn.onclick = () => {
                        this.removeLocation(index);
                        closeModal();
                    };

                    deleteModal.onclick = (e) => {
                        if (e.target === deleteModal) {
                            closeModal();
                        }
                    };
                } else {
                    // 如果没有笔记，直接删除
                    this.removeLocation(index);
                }
            });

            // 添加编辑按钮事件监听
            const editBtn = orderItem.querySelector('.edit-location');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.closest('.edit-location').dataset.index);
                this.openNoteEditor(index);
            });
            
            visitOrderList.appendChild(orderItem);
        });
    }

    removeLocation(index) {
        this.locations.splice(index, 1);
        this.updateRoutes();
        
        // 如果当前是已保存的行程，更新 localStorage
        if (this.currentTripName) {
            let savedTrips = JSON.parse(localStorage.getItem('savedTrips') || '[]');
            const tripIndex = savedTrips.findIndex(trip => trip.name === this.currentTripName);
            if (tripIndex !== -1) {
                savedTrips[tripIndex].locations = this.locations;
                localStorage.setItem('savedTrips', JSON.stringify(savedTrips));
            }
        }
    }

    initializeWeChatModal() {
        const modal = document.getElementById('wechat-modal');
        const wechatLink = document.getElementById('wechat-link');
        const closeBtn = document.querySelector('.close-modal');

        wechatLink.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden'; // 防止背景滚动
        });

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // 恢复滚动
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        // 添加 ESC 键关闭功能
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }

    initializeSaveTrip() {
        const saveBtn = document.getElementById('save-trip');
        const modal = document.getElementById('save-trip-modal');
        const closeBtn = modal.querySelector('.close-modal');
        const confirmBtn = document.getElementById('confirm-save-trip');
        const tripNameInput = document.getElementById('trip-name');

        saveBtn.addEventListener('click', () => {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            tripNameInput.value = '';
        });

        confirmBtn.addEventListener('click', () => {
            const tripName = tripNameInput.value.trim();
            if (tripName) {
                this.saveTrip(tripName);
                modal.style.display = 'none';
                document.body.style.overflow = '';
                tripNameInput.value = '';
            }
        });
    }

    saveTrip(name) {
        const trip = {
            name,
            locations: this.locations.map(location => ({
                ...location,
                notes: location.notes || [] // 确保包含每个地点的笔记
            })),
            date: new Date().toISOString()
        };

        let savedTrips = JSON.parse(localStorage.getItem('savedTrips') || '[]');
        savedTrips.push(trip);
        localStorage.setItem('savedTrips', JSON.stringify(savedTrips));
        
        this.updateSavedTripsList();
    }

    loadSavedTrips() {
        this.updateSavedTripsList();
    }

    updateSavedTripsList() {
        const savedTrips = JSON.parse(localStorage.getItem('savedTrips') || '[]');
        const tripsList = document.getElementById('saved-trips-list');
        const t = translations[this.currentLanguage];

        if (savedTrips.length === 0) {
            tripsList.innerHTML = `<a href="#" class="no-trips">${t.noSavedTrips}</a>`;
            return;
        }

        tripsList.innerHTML = savedTrips.map((trip, index) => `
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
        `).join('');

        // 添加编辑按钮事件监听
        tripsList.querySelectorAll('.edit-trip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const trip = savedTrips[index];
                
                // 显示保存行程模态框用于编辑
                const modal = document.getElementById('save-trip-modal');
                const input = document.getElementById('trip-name');
                const confirmBtn = document.getElementById('confirm-save-trip');
                
                // 设置标题和按钮文本
                modal.querySelector('h3').textContent = 'Edit Trip Name';
                confirmBtn.textContent = 'Update';
                
                // 填充当前名称
                input.value = trip.name;
                
                // 显示模态框
                modal.style.display = 'block';
                input.focus();
                
                // 处理更新
                const handleUpdate = () => {
                    const newName = input.value.trim();
                    if (newName) {
                        savedTrips[index].name = newName;
                        localStorage.setItem('savedTrips', JSON.stringify(savedTrips));
                        this.updateSavedTripsList();
                        modal.style.display = 'none';
                        
                        // 重置模态框
                        modal.querySelector('h3').textContent = 'Save Your Trip';
                        confirmBtn.textContent = 'Save';
                        input.value = '';
                    }
                };
                
                // 更新确认按钮事件
                confirmBtn.onclick = handleUpdate;
                
                // 处理回车键
                input.onkeypress = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUpdate();
                    }
                };
            });
        });

        // 修改删除按钮的事件监听
        tripsList.querySelectorAll('.delete-trip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();  // 阻止链接的默认行为
                e.stopPropagation(); // 阻止事件冒泡
                
                const index = parseInt(btn.dataset.index);
                const tripName = savedTrips[index].name;
                
                // 显示删除确认模态框
                const deleteModal = document.getElementById('delete-trip-modal');
                const message = deleteModal.querySelector('.delete-message');
                const confirmBtn = document.getElementById('confirm-delete-trip');
                const cancelBtn = document.getElementById('cancel-delete-trip');
                
                message.textContent = `Are you sure you want to delete "${tripName}"?`;
                deleteModal.style.display = 'block';

                // 处理取消按钮
                const closeModal = () => {
                    deleteModal.style.display = 'none';
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
        tripsList.querySelectorAll('.saved-trip').forEach(link => {
            link.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-trip') && !e.target.closest('.edit-trip')) {
                    e.preventDefault();
                    const index = parseInt(e.target.closest('.saved-trip').dataset.index);
                    const savedTrips = JSON.parse(localStorage.getItem('savedTrips') || '[]');
                    this.loadTrip(savedTrips[index]);
                }
            });
        });
    }

    loadTrip(trip) {
        // 清空当前路线
        this.locations = [];
        
        // 保存行程名称
        this.currentTripName = trip.name;
        
        // 更新左侧面板标题
        const visitOrderPanel = document.querySelector('.visit-order-panel h2');
        visitOrderPanel.textContent = this.currentTripName;
        
        // 深拷贝行程数据，包括笔记
        this.locations = JSON.parse(JSON.stringify(trip.locations.map(location => ({
            ...location,
            notes: location.notes || [] // 确保每个地点都有 notes 数组
        }))));
        
        // 清空搜索框
        this.searchInput.value = '';
        
        // 更新路线和显示
        this.updateRoutes();
    }

    deleteTrip(index) {
        let savedTrips = JSON.parse(localStorage.getItem('savedTrips') || '[]');
        savedTrips.splice(index, 1);
        localStorage.setItem('savedTrips', JSON.stringify(savedTrips));
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
        const loginBtn = document.getElementById('login-btn');
        const loginModal = document.getElementById('login-modal');
        const closeBtn = loginModal.querySelector('.close-modal');
        const googleLoginBtn = document.getElementById('google-login');
        const appleLoginBtn = document.getElementById('apple-login');
        const userProfile = document.querySelector('.user-profile');
        const logoutBtn = document.getElementById('logout-btn');

        // 检查登录状态
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // 用户已登录
                document.getElementById('login-btn').classList.add('hidden');
                userProfile.classList.remove('hidden');
                document.getElementById('user-avatar').src = user.photoURL || 'default-avatar.png';
                document.getElementById('user-name').textContent = user.displayName;
            } else {
                // 用户未登录
                document.getElementById('login-btn').classList.remove('hidden');
                userProfile.classList.add('hidden');
            }
        });

        // 登录按钮点击事件
        loginBtn.addEventListener('click', () => {
            loginModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        // 关闭模态框
        closeBtn.addEventListener('click', () => {
            loginModal.style.display = 'none';
            document.body.style.overflow = '';
        });

        // Google 登录
        googleLoginBtn.addEventListener('click', async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                await firebase.auth().signInWithPopup(provider);
                loginModal.style.display = 'none';
                document.body.style.overflow = '';
            } catch (error) {
                console.error('Google login error:', error);
            }
        });

        // Apple 登录
        appleLoginBtn.addEventListener('click', async () => {
            const provider = new firebase.auth.OAuthProvider('apple.com');
            try {
                await firebase.auth().signInWithPopup(provider);
                loginModal.style.display = 'none';
                document.body.style.overflow = '';
            } catch (error) {
                console.error('Apple login error:', error);
            }
        });

        // 登出
        logoutBtn.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // 修改保存笔记的方法
    saveLocationNote() {
        if (this.currentEditingLocationIndex !== null) {
            const editor = document.getElementById('note-editor');
            const saveBtn = document.getElementById('save-note');
            const cancelBtn = document.getElementById('cancel-note');
            const noteContent = editor.value.trim();
            
            if (noteContent) {
                if (this.editingNoteId) {
                    // 更新现有笔记
                    const notes = this.locations[this.currentEditingLocationIndex].notes;
                    const index = notes.findIndex(n => n.id.toString() === this.editingNoteId);
                    if (index !== -1) {
                        notes[index] = {
                            ...notes[index],
                            content: noteContent,
                            date: new Date().toISOString()
                        };
                    }
                    this.editingNoteId = null;
                } else {
                    // 创建新笔记
                    const newNote = {
                        content: noteContent,
                        date: new Date().toISOString(),
                        id: Date.now()
                    };

                    if (!this.locations[this.currentEditingLocationIndex].notes) {
                        this.locations[this.currentEditingLocationIndex].notes = [];
                    }
                    this.locations[this.currentEditingLocationIndex].notes.push(newNote);
                }

                // 更新显示
                this.updateNotesList();
                
                // 重置编辑器和按钮
                editor.value = '';
                saveBtn.textContent = 'Add Note';
                cancelBtn.style.display = 'none';
                
                // 如果是已保存的行程，更新localStorage
                if (this.locations[this.currentEditingLocationIndex].savedTripId) {
                    this.updateSavedTrip(this.locations[this.currentEditingLocationIndex].savedTripId);
                }
            }
        }
    }

    // 添加更新笔记列表的方法
    updateNotesList() {
        const notesList = document.querySelector('.notes-list');
        if (!notesList) {
            console.error('Notes list container not found');
            return;
        }

        const locationNotes = this.locations[this.currentEditingLocationIndex].notes || [];
        
        if (locationNotes.length === 0) {
            notesList.innerHTML = '<div class="no-notes">No notes yet</div>';
            return;
        }

        notesList.innerHTML = locationNotes.map(note => `
            <div class="note-card" data-note-id="${note.id}">
                <div class="note-header">
                    <div class="note-date">${new Date(note.date).toLocaleString()}</div>
                    <div class="note-actions">
                        <button class="edit-note" title="Edit note">
                            <svg class="edit-icon" viewBox="0 0 24 24">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="delete-note" title="Delete note">
                            <svg class="delete-icon" viewBox="0 0 24 24">
                                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="note-content">${note.content}</div>
            </div>
        `).join('');

        // 添加编辑和删除事件监听
        notesList.querySelectorAll('.edit-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.target.closest('.note-card').dataset.noteId;
                this.editNote(noteId);
            });
        });

        notesList.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteCard = e.target.closest('.note-card');
                const noteId = noteCard.dataset.noteId;
                
                // 显示删除笔记确认话框
                const deleteModal = document.getElementById('delete-note-modal');
                const confirmBtn = document.getElementById('confirm-delete-note');
                const cancelBtn = document.getElementById('cancel-delete-note');
                
                // 显示模态框
                deleteModal.style.display = 'block';
                document.body.style.overflow = 'hidden';

                // 处理取消按钮
                const closeModal = () => {
                    deleteModal.style.display = 'none';
                    document.body.style.overflow = '';
                };

                cancelBtn.onclick = closeModal;
                deleteModal.querySelector('.close-modal').onclick = closeModal;

                // 处理确认删除按钮
                confirmBtn.onclick = () => {
                    const notes = this.locations[this.currentEditingLocationIndex].notes;
                    const index = notes.findIndex(n => n.id.toString() === noteId);
                    if (index !== -1) {
                        notes.splice(index, 1);
                        this.updateNotesList();
                    }
                    closeModal();
                };

                // 点击模态框外部关闭
                deleteModal.onclick = (e) => {
                    if (e.target === deleteModal) {
                        closeModal();
                    }
                };
            });
        });
    }

    // 修改编辑笔记的方法
    editNote(noteId) {
        const notes = this.locations[this.currentEditingLocationIndex].notes;
        const note = notes.find(n => n.id.toString() === noteId);
        if (note) {
            const editor = document.getElementById('note-editor');
            const saveBtn = document.getElementById('save-note');
            const cancelBtn = document.getElementById('cancel-note');
            
            editor.value = note.content;
            saveBtn.textContent = 'Update Note';
            cancelBtn.style.display = 'block'; // 编辑时显示取消按钮
            
            this.editingNoteId = noteId;
            editor.focus();
        }
    }

    // 修改取消编辑的方法
    cancelNote() {
        const editor = document.getElementById('note-editor');
        const saveBtn = document.getElementById('save-note');
        const cancelBtn = document.getElementById('cancel-note');
        
        editor.value = '';
        saveBtn.textContent = 'Add Note';
        cancelBtn.style.display = 'none'; // 取消后隐藏取消按钮
        
        this.editingNoteId = null;
    }

    // 修改打开编辑器的方法
    openNoteEditor(locationIndex) {
        const modal = document.getElementById('editor-modal');
        const editor = document.getElementById('note-editor');
        const saveBtn = document.getElementById('save-note');
        const cancelBtn = document.getElementById('cancel-note');
        
        this.currentEditingLocationIndex = locationIndex;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // 重置编辑器状态
        editor.value = '';
        saveBtn.textContent = 'Add Note';
        cancelBtn.style.display = 'none'; // 默认隐藏取消按钮
        this.editingNoteId = null;
        
        // 更新笔记列表
        this.updateNotesList();

        // 添加事件监听
        const closeBtn = modal.querySelector('.close-modal');

        closeBtn.onclick = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            this.currentEditingLocationIndex = null;
            this.editingNoteId = null;
        };

        saveBtn.onclick = () => {
            this.saveLocationNote();
        };

        cancelBtn.onclick = () => {
            this.cancelNote();
        };

        // 点击模态框外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
                this.currentEditingLocationIndex = null;
                this.editingNoteId = null;
            }
        };
    }
}

function initializeTravelPlanner() {
    if (typeof google === 'undefined') {
        console.error('Google Maps API 未能正确加载');
        return;
    }
    window.travelPlanner = new TravelPlanner();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTravelPlanner);
} else {
    initializeTravelPlanner();
} 