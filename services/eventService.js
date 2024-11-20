class EventService {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.setupAuthEvents();
        this.setupMapEvents();
        this.setupUIEvents();
    }
} 