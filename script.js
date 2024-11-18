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
    }

    initializeAutocomplete() {
        // 首先创建基本的自动完成对象
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
                    
                    // 可选：添加一个圆形区域来显示搜索范围
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
                <div class="route-number">Route ${this.locations.indexOf(start) + 1}</div>
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
        languageSelect.addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
            this.updateLanguage();
        });
    }

    updateLanguage() {
        document.title = translations[this.currentLanguage].title;
        
        // 更新搜索区域
        this.searchInput.placeholder = translations[this.currentLanguage].searchPlaceholder;
        this.addButton.textContent = translations[this.currentLanguage].addLocation;
        document.querySelector('.location-hint').textContent = translations[this.currentLanguage].locationHint;
        
        // 更新总结区域
        document.querySelector('.summary-section h2').textContent = translations[this.currentLanguage].tripSummary;
        document.querySelector('.locations-list h3').textContent = translations[this.currentLanguage].visitOrder;
        
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
                <button class="delete-location" data-index="${index}" title="Delete location">
                    <svg class="delete-icon" viewBox="0 0 24 24">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                    </svg>
                </button>
            `;
            
            // 添加删除按钮事件监听
            const deleteBtn = orderItem.querySelector('.delete-location');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.locations.splice(index, 1);
                this.updateRoutes();
            });
            
            visitOrderList.appendChild(orderItem);
        });
    }

    removeLocation(index) {
        this.locations.splice(index, 1);
        this.updateRoutes();
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