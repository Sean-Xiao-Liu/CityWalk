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
        
        // 延迟初始化地图
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
        
        // 更新访问顺序面板标题
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
                this.locations.splice(index, 1);
                this.updateRoutes();
            });

            // 添加编辑按钮事件监听
            const editBtn = orderItem.querySelector('.edit-location');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 这里可以添加编辑功能的处理逻辑
            });
            
            visitOrderList.appendChild(orderItem);
        });
    }

    removeLocation(index) {
        this.locations.splice(index, 1);
        this.updateRoutes();
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
            locations: this.locations,
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
                ${trip.name}
                <span class="delete-trip" data-index="${index}" title="Delete trip">×</span>
            </a>
        `).join('');

        // 添加点击事件处理
        tripsList.querySelectorAll('.saved-trip').forEach(link => {
            link.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-trip')) {
                    const index = e.target.dataset.index;
                    this.loadTrip(savedTrips[index]);
                }
            });
        });

        // 修改删除按钮的点击事件
        tripsList.querySelectorAll('.delete-trip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = e.target.dataset.index;
                const tripName = savedTrips[index].name;
                
                // 显示删除确认模态框
                const deleteModal = document.getElementById('delete-trip-modal');
                const message = deleteModal.querySelector('.delete-trip-message');
                message.textContent = `Are you sure you want to delete "${tripName}"?`;
                
                deleteModal.style.display = 'block';
                document.body.style.overflow = 'hidden';

                // 处理取消按钮
                const cancelBtn = document.getElementById('cancel-delete-trip');
                cancelBtn.onclick = () => {
                    deleteModal.style.display = 'none';
                    document.body.style.overflow = '';
                };

                // 处理确认删除按钮
                const confirmBtn = document.getElementById('confirm-delete-trip');
                confirmBtn.onclick = () => {
                    this.deleteTrip(index);
                    deleteModal.style.display = 'none';
                    document.body.style.overflow = '';
                };

                // 处理关闭按钮
                const closeBtn = deleteModal.querySelector('.close-modal');
                closeBtn.onclick = () => {
                    deleteModal.style.display = 'none';
                    document.body.style.overflow = '';
                };

                // 点击模态框外部关闭
                deleteModal.onclick = (e) => {
                    if (e.target === deleteModal) {
                        deleteModal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                };
            });
        });
    }

    loadTrip(trip) {
        this.locations = trip.locations;
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