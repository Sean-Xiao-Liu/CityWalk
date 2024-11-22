export function initializeAutocomplete() {
    // 首先建基本的自动完成对象
    this.autocomplete = new google.maps.places.Autocomplete(this.searchInput, {
      types: ["establishment", "geocode"],
      fields: ["name", "geometry", "formatted_address", "place_id"],
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
              position.coords.latitude - 0.5, // 向南扩展约50公里
              position.coords.longitude - 0.5 // 向西扩展约50公里
            ),
            new google.maps.LatLng(
              position.coords.latitude + 0.5, // 向北扩展约50公里
              position.coords.longitude + 0.5 // 向东扩展约50公里
            )
          );

          // 更新自动完成的搜索偏好
          this.autocomplete.setBounds(bounds);

          // 可选：添加一个圆形区来显示搜索范围
          new google.maps.Circle({
            center: userLocation,
            radius: 50000, // 50公里半径
          }).setBounds(bounds);
        },
        (error) => {
          console.warn("无法获取用户位置:", error);
          // 如果无法获取位置，使用默认的美国范围
          const defaultBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(25.82, -124.39), // 美国西南角
            new google.maps.LatLng(49.38, -66.94) // 美国东北角
          );
          this.autocomplete.setBounds(defaultBounds);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }

    this.autocomplete.addListener("place_changed", () => {
      const place = this.autocomplete.getPlace();
      if (place && place.geometry) {
        this.addLocation(place);
      }
    });

    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
  }
