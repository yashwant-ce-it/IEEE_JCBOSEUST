/**
 * THE CITADEL - APPLICATION CONTROLLER
 * Core WebGL rendering, scroll animation, and DOM interaction.
 */

(function() {
  'use strict';

  // 1. App State
  let scene, camera, renderer;
  let particles;
  let citadelCore, zoneTechX, zoneInvenio, zoneRoboClash;
  let interactiveObjects = [];
  
  let isRendering = true;
  let currentHovered = null;
  let modalStatePushed = false;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // Camera Target (for smooth looking transitions)
  const cameraTarget = new THREE.Vector3(0, 0.5, 0);

  // Event list mapping for the registration modal
  const zoneEvents = {
    'Tech-X': [
      { value: 'hackathon', text: 'Tech-X 24H Hackathon' },
      { value: 'coding', text: 'Competitive Programming Arena' },
      { value: 'opensource', text: 'Open Source Showdown' }
    ],
    'Invenio': [
      { value: 'ai-symposium', text: 'AI & Deep Learning Symposium' },
      { value: 'startup-bootcamp', text: 'Startup Ideation Bootcamp' },
      { value: 'paper-presentation', text: 'IEEE Research Paper Presentation' }
    ],
    'RoboClash': [
      { value: 'line-follower', text: 'Autonomous Line Follower Race' },
      { value: 'robo-sumo', text: 'Robo Sumo Wrestling Arena' },
      { value: 'embedded-expo', text: 'Embedded System Projects Expo' }
    ]
  };

  // 2. Initial Setup
  window.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Gating check
    if (window.isLowTierDevice) {
      bypassToStatic();
      return;
    }
    
    // Start Cinematic Intro & background WebGL compilation sequence
    runCinematicIntro();
  });

  // 3. Low-Tier Gating Fallback
  function bypassToStatic() {
    const introContainer = document.getElementById('intro-container');
    if (introContainer) introContainer.classList.add('hidden');
    
    // Set active link tracking on scroll for normal 2D layout
    setupScrollNavigation();
    setupModalHandlers();
  }

  // 4. Cinematic Video Intro & Background Preloading
  function runCinematicIntro() {
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('skip-intro-btn');
    const introContainer = document.getElementById('intro-container');
    let introFinished = false;

    // A. Set initial state of 2D DOM elements for smooth staggered GSAP reveal later
    gsap.set('.header', { opacity: 0 });
    gsap.set('.hero-tagline', { opacity: 0, y: 20 });
    gsap.set('.hero-title', { opacity: 0, y: 30 });
    gsap.set('.hero-desc', { opacity: 0, y: 20 });
    gsap.set('.hero-buttons', { opacity: 0, y: 15 });
    gsap.set('.scroll-indicator', { opacity: 0 });

    // B. Immediately boot WebGL Scene in the background while video is playing
    // This allows Three.js parallel compilation of shaders and setup
    initWebGL();
    setupScrollTrigger();
    setupScrollNavigation();
    setupModalHandlers();
    animate();

    // C. Safety Fallback: 9-second timeout to prevent getting locked on a black screen
    const safetyTimeout = setTimeout(() => {
      console.warn("Cinematic Intro: Safety fallback triggered. Video took too long or was blocked. Bypassing.");
      completeIntro(false);
    }, 9000);

    // C2. Start programmatically playing the cinematic intro video
    if (video) {
      video.play().catch(err => {
        console.warn("Autoplay block prevention: video playback needs user interaction or has been deferred.", err);
      });
    }

    // Function to trigger fade out sequence & staggered reveal
    const completeIntro = (isSkip) => {
      if (introFinished) return;
      introFinished = true;

      // Clear safety timeout
      clearTimeout(safetyTimeout);

      // Pause the video immediately if skipped to free up processing/RAM
      if (isSkip && video) {
        try {
          video.pause();
        } catch (e) {
          console.warn("Could not pause video: ", e);
        }
      }

      // Smooth fade out of the intro layer container using GSAP
      gsap.to(introContainer, {
        opacity: 0,
        duration: isSkip ? 0.8 : 1.5,
        ease: isSkip ? 'power2.out' : 'power2.inOut',
        onComplete: () => {
          // Entirely remove the intro layer from the DOM tree (Unmount to release video RAM/Memory)
          if (introContainer) {
            introContainer.remove();
          }
          console.log("Cinematic Intro: Container removed from DOM. Video RAM cleared.");
        }
      });

      // Staggered reveal of 2D DOM elements (starts right as video fades)
      const delayOffset = isSkip ? 0.1 : 0.5;

      gsap.to('.header', {
        opacity: 1,
        duration: 1.0,
        delay: delayOffset,
        ease: 'power2.out'
      });

      gsap.to('.hero-tagline', {
        opacity: 1,
        y: 0,
        duration: 1.0,
        delay: delayOffset + 0.1,
        ease: 'power2.out'
      });

      gsap.to('.hero-title', {
        opacity: 1,
        y: 0,
        duration: 1.0,
        delay: delayOffset + 0.2,
        ease: 'power2.out'
      });

      gsap.to('.hero-desc', {
        opacity: 1,
        y: 0,
        duration: 1.0,
        delay: delayOffset + 0.3,
        ease: 'power2.out'
      });

      gsap.to('.hero-buttons', {
        opacity: 1,
        y: 0,
        duration: 1.0,
        delay: delayOffset + 0.4,
        ease: 'power2.out'
      });

      gsap.to('.scroll-indicator', {
        opacity: 1,
        duration: 1.0,
        delay: delayOffset + 0.6,
        ease: 'power2.out'
      });
    };

    // D. Event listeners for end of video, errors, and skip action
    if (video) {
      video.addEventListener('ended', () => {
        completeIntro(false);
      });

      video.addEventListener('error', (e) => {
        console.warn("Cinematic Intro: Video error occurred. Details:", video.error);
        completeIntro(false);
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        completeIntro(true);
      });
    }
  }

  // 5. Initialize WebGL Scene
  function initWebGL() {
    const canvas = document.getElementById('webgl-canvas');
    
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07070b, 0.015);
    
    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 15);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Lights (Minimal real-time shadows, heavy baking vibes via glowing materials)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);
    
    const pointLight1 = new THREE.PointLight(0x00f0ff, 1, 100);
    pointLight1.position.set(5, 10, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff0055, 0.8, 100);
    pointLight2.position.set(-5, -5, -10);
    scene.add(pointLight2);

    // Create 3D Objects
    createCitadelObjects();
    
    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onCanvasClick);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
  }

  // 6. Create Procedural Cyber Geometry
  function createCitadelObjects() {
    // A. Star/Particle Field
    const particleCount = 1500;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    const colorOptions = [
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xff0055), // Red
      new THREE.Color(0x0088ff), // Blue
      new THREE.Color(0x39ff14)  // Green
    ];

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Cylindrical distribution around Y axis
      const radius = Math.random() * 30 + 5;
      const theta = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 60;
      
      positions[i] = radius * Math.cos(theta);
      positions[i + 1] = height;
      positions[i + 2] = radius * Math.sin(theta);
      
      // Color
      const randomColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      colors[i] = randomColor.r;
      colors[i + 1] = randomColor.g;
      colors[i + 2] = randomColor.b;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Custom Point Texture using HTML Canvas for glowing spherical particles
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const starTex = new THREE.CanvasTexture(canvas);

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      map: starTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // B. Citadel Core (Center Octahedron / Dodecahedron hologram)
    citadelCore = new THREE.Group();
    citadelCore.position.set(0, 0.5, 0);
    scene.add(citadelCore);

    const coreGeo = new THREE.IcosahedronGeometry(2, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    citadelCore.add(coreMesh);

    const outerCoreGeo = new THREE.DodecahedronGeometry(2.5, 0);
    const outerCoreMat = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    const outerCoreMesh = new THREE.Mesh(outerCoreGeo, outerCoreMat);
    citadelCore.add(outerCoreMesh);

    // C. Tech-X Zone Mesh (Wireframe Cyber Cubes)
    zoneTechX = new THREE.Group();
    zoneTechX.position.set(-8, 5, -15);
    zoneTechX.userData = { zoneName: 'Tech-X', color: '#ff0055', scaleFactor: 1 };
    scene.add(zoneTechX);
    interactiveObjects.push(zoneTechX);

    const techGeoMain = new THREE.BoxGeometry(2, 2, 2);
    const techMatMain = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const techMeshMain = new THREE.Mesh(techGeoMain, techMatMain);
    zoneTechX.add(techMeshMain);

    // Smaller rotating child cube
    const techGeoSub = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const techMatSub = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      transparent: true,
      opacity: 0.18
    });
    const techMeshSub = new THREE.Mesh(techGeoSub, techMatSub);
    zoneTechX.add(techMeshSub);

    // Orbiting ring
    const ringGeo1 = new THREE.RingGeometry(1.6, 1.7, 32);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 2;
    zoneTechX.add(ringMesh1);

    // D. Invenio Zone Mesh (Gyroscope Planetary Spheres)
    zoneInvenio = new THREE.Group();
    zoneInvenio.position.set(8, 0, -30);
    zoneInvenio.userData = { zoneName: 'Invenio', color: '#0088ff', scaleFactor: 1 };
    scene.add(zoneInvenio);
    interactiveObjects.push(zoneInvenio);

    const invGeoCore = new THREE.SphereGeometry(1, 16, 16);
    const invMatCore = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const invMeshCore = new THREE.Mesh(invGeoCore, invMatCore);
    zoneInvenio.add(invMeshCore);

    // Ring 1
    const invRingGeo1 = new THREE.TorusGeometry(1.8, 0.05, 8, 64);
    const invRingMat1 = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.6 });
    const invRingMesh1 = new THREE.Mesh(invRingGeo1, invRingMat1);
    zoneInvenio.add(invRingMesh1);

    // Ring 2 (Offset Axis)
    const invRingMesh2 = invRingMesh1.clone();
    invRingMesh2.rotation.y = Math.PI / 2;
    zoneInvenio.add(invRingMesh2);

    // Ring 3 (Tilt Axis)
    const invRingMesh3 = invRingMesh1.clone();
    invRingMesh3.rotation.x = Math.PI / 4;
    zoneInvenio.add(invRingMesh3);

    // E. RoboClash Zone Mesh (Futuristic Green Torus Knot)
    zoneRoboClash = new THREE.Group();
    zoneRoboClash.position.set(-6, -5, -45);
    zoneRoboClash.userData = { zoneName: 'RoboClash', color: '#39ff14', scaleFactor: 1 };
    scene.add(zoneRoboClash);
    interactiveObjects.push(zoneRoboClash);

    const roboGeo = new THREE.TorusKnotGeometry(1.2, 0.35, 100, 16, 2, 3);
    const roboMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const roboMesh = new THREE.Mesh(roboGeo, roboMat);
    zoneRoboClash.add(roboMesh);

    // Orbital ring
    const roboRingGeo = new THREE.TorusGeometry(2.2, 0.04, 8, 48);
    const roboRingMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.4 });
    const roboRingMesh = new THREE.Mesh(roboRingGeo, roboRingMat);
    roboRingMesh.rotation.x = Math.PI / 2.5;
    zoneRoboClash.add(roboRingMesh);
  }

  // 7. Setup GSAP ScrollTrigger Cam Pathway
  function setupScrollTrigger() {
    gsap.registerPlugin(ScrollTrigger);
    
    // Main Timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 1, // Smooth scrub
        invalidateOnRefresh: true
      }
    });

    // Animate camera position and target looking vectors across scroll steps
    tl.to(camera.position, { x: -4, y: 4.5, z: -10, ease: "none" })
      .to(cameraTarget, { x: -8, y: 5, z: -15, ease: "none" }, 0)
      
      // Step 2: Transition to Invenio (Blue Zone)
      .to(camera.position, { x: 3, y: 1.2, z: -25, ease: "none" })
      .to(cameraTarget, { x: 8, y: 0, z: -30, ease: "none" }, ">")
      
      // Step 3: Transition to RoboClash (Green Zone)
      .to(camera.position, { x: -2, y: -3.5, z: -40, ease: "none" })
      .to(cameraTarget, { x: -6, y: -5, z: -45, ease: "none" }, ">")
      
      // Step 4: Zoom out to view entire Citadel above the clouds (Footer view)
      .to(camera.position, { x: 0, y: 14, z: -20, ease: "none" })
      .to(cameraTarget, { x: 0, y: 0, z: -25, ease: "none" }, ">");
  }

  // 8. Navigation Active State Tracker on Scroll
  function setupScrollNavigation() {
    const sections = document.querySelectorAll('.scroll-section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
      let current = '';
      const scrollPos = window.scrollY + window.innerHeight / 3;
      
      sections.forEach(sec => {
        const top = sec.offsetTop;
        const height = sec.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          current = sec.getAttribute('id');
        }
      });
      
      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        link.classList.remove('active');
        if (href && href.startsWith('#') && href.slice(1) === current) {
          link.classList.add('active');
        }
      });
    });
  }

  // 9. Canvas Interaction & Raycasting (Hover / Click meshes)
  function handlePointerMove(clientX, clientY) {
    // Map coords to normalized device coords (-1 to +1)
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    if (!isRendering) return;

    raycaster.setFromCamera(mouse, camera);
    
    // We raycast against the first layer children of each zone group
    let intersects = [];
    interactiveObjects.forEach(group => {
      const hits = raycaster.intersectObjects(group.children, true);
      if (hits.length > 0) {
        intersects.push({ group: group, hit: hits[0] });
      }
    });

    if (intersects.length > 0) {
      const targetGroup = intersects[0].group;
      
      if (currentHovered !== targetGroup) {
        // Reset old hover
        resetHover();
        
        // Highlight new hover
        currentHovered = targetGroup;
        document.body.style.cursor = 'pointer';
        
        // Scale up with GSAP
        gsap.to(targetGroup.userData, { scaleFactor: 1.2, duration: 0.3 });
        
        // Highlight material opacities
        targetGroup.children.forEach(mesh => {
          if (mesh.material) {
            mesh.material.opacity = Math.min(1.0, mesh.material.opacity * 1.5);
          }
        });
      }
    } else {
      resetHover();
    }
  }

  function onMouseMove(event) {
    handlePointerMove(event.clientX, event.clientY);
  }

  function onTouchStart(event) {
    if (event.touches && event.touches.length > 0) {
      handlePointerMove(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  function resetHover() {
    if (currentHovered) {
      const resetGroup = currentHovered;
      currentHovered = null;
      document.body.style.cursor = 'default';
      
      gsap.to(resetGroup.userData, { scaleFactor: 1.0, duration: 0.3 });
      
      // Restore default opacities
      const isTech = resetGroup.userData.zoneName === 'Tech-X';
      const isInv = resetGroup.userData.zoneName === 'Invenio';
      const isRobo = resetGroup.userData.zoneName === 'RoboClash';
      
      resetGroup.children.forEach((mesh, index) => {
        if (mesh.material) {
          if (index === 0) mesh.material.opacity = isTech ? 0.7 : (isInv ? 0.8 : 0.65);
          if (index === 1) mesh.material.opacity = isTech ? 0.18 : 0.6;
          if (index > 1) mesh.material.opacity = 0.5;
        }
      });
    }
  }

  function onCanvasClick() {
    if (currentHovered && isRendering) {
      openRegistrationModal(currentHovered.userData.zoneName);
    }
  }

  // 10. Modal Gating Engine (Pause Render Loop, Blur Canvas)
  function setupModalHandlers() {
    const modal = document.getElementById('modal-container');
    const closeBtn = document.getElementById('close-modal-btn');
    const successCloseBtn = document.getElementById('success-close-btn');
    const form = document.getElementById('registration-form');
    
    // Card buttons
    document.querySelectorAll('.open-reg-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRegistrationModal(btn.getAttribute('data-zone'));
      });
    });

    // General navbar/hero buttons
    document.querySelectorAll('.trigger-modal-general, #nav-register-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRegistrationModal('General');
      });
    });

    // Close actions
    closeBtn.addEventListener('click', closeRegistrationModal);
    successCloseBtn.addEventListener('click', closeRegistrationModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeRegistrationModal);

    // Form Submit Handler
    form.addEventListener('submit', handleFormSubmit);

    // Handle back button popping state to close modal
    window.addEventListener('popstate', (e) => {
      const mc = document.getElementById('modal-container');
      if (mc && !mc.classList.contains('hidden')) {
        closeRegistrationModal(true);
      }
    });
  }

  function openRegistrationModal(zoneName) {
    const modal = document.getElementById('modal-container');
    const zoneTitle = document.getElementById('modal-zone-title');
    const formZoneInput = document.getElementById('form-zone');
    const eventSelect = document.getElementById('form-event');
    const canvas = document.getElementById('webgl-canvas');
    
    // 1. Reset forms
    document.getElementById('registration-form').classList.remove('hidden');
    document.getElementById('modal-success-screen').classList.add('hidden');
    document.getElementById('registration-form').reset();
    
    // 2. Set zone header & field
    zoneTitle.textContent = `ZONE: ${zoneName.toUpperCase()}`;
    formZoneInput.value = zoneName;

    // Adjust Glow borders on modal based on Zone Color
    const modalCSSCard = modal.querySelector('.modal-card');
    modalCSSCard.style.boxShadow = `0 0 50px rgba(255, 255, 255, 0.08)`;
    
    if (zoneName === 'Tech-X') {
      modalCSSCard.style.borderColor = 'var(--color-red)';
      modalCSSCard.style.boxShadow = `0 0 50px rgba(255, 0, 85, 0.25)`;
      zoneTitle.style.color = 'var(--color-red)';
      zoneTitle.style.textShadow = '0 0 10px var(--color-red-glow)';
    } else if (zoneName === 'Invenio') {
      modalCSSCard.style.borderColor = 'var(--color-blue)';
      modalCSSCard.style.boxShadow = `0 0 50px rgba(0, 136, 255, 0.25)`;
      zoneTitle.style.color = 'var(--color-blue)';
      zoneTitle.style.textShadow = '0 0 10px var(--color-blue-glow)';
    } else if (zoneName === 'RoboClash') {
      modalCSSCard.style.borderColor = 'var(--color-green)';
      modalCSSCard.style.boxShadow = `0 0 50px rgba(57, 255, 20, 0.25)`;
      zoneTitle.style.color = 'var(--color-green)';
      zoneTitle.style.textShadow = '0 0 10px var(--color-green-glow)';
    } else {
      modalCSSCard.style.borderColor = 'var(--color-cyan)';
      modalCSSCard.style.boxShadow = `0 0 50px rgba(0, 240, 255, 0.25)`;
      zoneTitle.style.color = 'var(--color-cyan)';
      zoneTitle.style.textShadow = '0 0 10px var(--color-cyan-glow)';
    }

    // 3. Dynamic Events Populating
    eventSelect.innerHTML = '<option value="" disabled selected>Select Event</option>';
    
    if (zoneName === 'General') {
      // Populate all events
      Object.keys(zoneEvents).forEach(z => {
        zoneEvents[z].forEach(ev => {
          const opt = document.createElement('option');
          opt.value = ev.value;
          opt.textContent = `[${z}] ${ev.text}`;
          eventSelect.appendChild(opt);
        });
      });
    } else if (zoneEvents[zoneName]) {
      zoneEvents[zoneName].forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.value;
        opt.textContent = ev.text;
        eventSelect.appendChild(opt);
      });
    }

    // 4. Pause rendering loop (saves CPU/GPU memory)
    isRendering = false;
    
    // 5. Blur WebGL Canvas and show modal overlay
    if (canvas) canvas.classList.add('blurred');
    modal.classList.remove('hidden');

    // Push history state to support back button close
    history.pushState({ modalOpen: true }, '');
    modalStatePushed = true;
    
    console.log(`WebGL Render Loop: PAUSED. Form Modal for [${zoneName}] active.`);
  }

  function closeRegistrationModal(fromPopState) {
    const modal = document.getElementById('modal-container');
    const canvas = document.getElementById('webgl-canvas');
    
    modal.classList.add('hidden');
    if (canvas) canvas.classList.remove('blurred');
    
    // Resume render loop
    if (!isRendering && !window.isLowTierDevice) {
      isRendering = true;
      animate();
      console.log('WebGL Render Loop: RESUMED.');
    }

    // If closed manually (not via back button pop), remove the pushed history state
    if (modalStatePushed && fromPopState !== true) {
      modalStatePushed = false;
      history.back();
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.loader-spinner');
    
    // Transition to loading state
    submitBtn.disabled = true;
    btnText.style.opacity = 0.5;
    spinner.classList.remove('hidden');
    
    // Simulate API Network transmission
    setTimeout(() => {
      submitBtn.disabled = false;
      btnText.style.opacity = 1;
      spinner.classList.add('hidden');
      
      // Hide form, show beautiful Success screen
      document.getElementById('registration-form').classList.add('hidden');
      document.getElementById('modal-success-screen').classList.remove('hidden');
      
      showToast("Enrollment transmission secured!");
    }, 1500);
  }

  // 11. Toast System
  function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-success font-outfit';
    toast.innerHTML = `<i data-lucide="shield-check"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    if (window.lucide) {
      window.lucide.createIcons({ node: toast });
    }
    
    // Auto remove toast
    setTimeout(() => {
      toast.style.opacity = 0;
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3500);
  }

  // 12. Resize Handler
  function onWindowResize() {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // 13. Render Loop Animation
  function animate() {
    if (!isRendering) return;
    requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001;
    
    // A. Orbit Particles
    if (particles) {
      particles.rotation.y = time * 0.02;
    }
    
    // B. Animate Citadel Core
    if (citadelCore) {
      citadelCore.rotation.y = time * 0.15;
      citadelCore.rotation.x = Math.sin(time * 0.1) * 0.1;
      
      // Pulsing scale
      const pulse = 1.0 + Math.sin(time * 2.0) * 0.04;
      citadelCore.scale.set(pulse, pulse, pulse);
    }
    
    // C. Animate Tech-X Cubes (Scale dynamically based on hover status)
    if (zoneTechX) {
      const curScale = zoneTechX.userData.scaleFactor;
      // Lerp scale
      zoneTechX.scale.x += (curScale - zoneTechX.scale.x) * 0.1;
      zoneTechX.scale.y += (curScale - zoneTechX.scale.y) * 0.1;
      zoneTechX.scale.z += (curScale - zoneTechX.scale.z) * 0.1;
      
      zoneTechX.children[0].rotation.y = time * 0.4;
      zoneTechX.children[0].rotation.x = time * 0.2;
      
      zoneTechX.children[1].rotation.y = -time * 0.6;
      zoneTechX.children[1].rotation.z = time * 0.3;
      
      // Rotate ring
      zoneTechX.children[2].rotation.z = time * 0.2;
    }
    
    // D. Animate Invenio Gyroscope
    if (zoneInvenio) {
      const curScale = zoneInvenio.userData.scaleFactor;
      zoneInvenio.scale.x += (curScale - zoneInvenio.scale.x) * 0.1;
      zoneInvenio.scale.y += (curScale - zoneInvenio.scale.y) * 0.1;
      zoneInvenio.scale.z += (curScale - zoneInvenio.scale.z) * 0.1;

      zoneInvenio.children[0].rotation.y = -time * 0.2;
      
      // Rotate orbital rings at different speed directions
      zoneInvenio.children[1].rotation.x = time * 0.5;
      zoneInvenio.children[2].rotation.y = time * 0.8;
      zoneInvenio.children[3].rotation.z = -time * 0.4;
    }
    
    // E. Animate RoboClash Torus Knot
    if (zoneRoboClash) {
      const curScale = zoneRoboClash.userData.scaleFactor;
      zoneRoboClash.scale.x += (curScale - zoneRoboClash.scale.x) * 0.1;
      zoneRoboClash.scale.y += (curScale - zoneRoboClash.scale.y) * 0.1;
      zoneRoboClash.scale.z += (curScale - zoneRoboClash.scale.z) * 0.1;

      zoneRoboClash.children[0].rotation.x = time * 0.3;
      zoneRoboClash.children[0].rotation.y = time * 0.5;
      
      zoneRoboClash.children[1].rotation.z = time * 0.2;
    }
    
    // F. Smooth Camera LookAt Lerping
    camera.lookAt(cameraTarget);
    
    // G. Render frame
    renderer.render(scene, camera);
  }

})();
