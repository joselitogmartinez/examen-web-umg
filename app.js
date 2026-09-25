const API_BASE = 'https://back-semprivado-umg-h6fkf2bng2avgrgw.westus3-01.azurewebsites.net/api';

// Estado de la aplicación
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let allVideos = [];

document.addEventListener('DOMContentLoaded', () => {
  renderSessionUI();
});

// Control visual del estado de usuario (autenticado vs visitante)
function renderSessionUI() {
  const sessionContainer = document.getElementById('user-session');
  if (currentUser) {
    sessionContainer.innerHTML = `
      <span class="text-sm">Bienvenido, <strong>${currentUser.estudiante || currentUser.carne}</strong></span>
      <button onclick="logout()" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">Cerrar Sesión</button>
    `;
  } else {
    sessionContainer.innerHTML = `
      <button onclick="openAuthModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold">Iniciar Sesión / Registro</button>
    `;
  }
}

function logout() {
  localStorage.removeItem('currentUser');
  currentUser = null;
  renderSessionUI();
  location.reload();
}


// --- CONTROL DEL MODAL Y PESTAÑAS ---
const authModal = document.getElementById('auth-modal');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

function openAuthModal() {
  authModal.classList.remove('hidden');
}

document.getElementById('close-modal')?.addEventListener('click', () => {
  authModal.classList.add('hidden');
});

tabLogin?.addEventListener('click', () => {
  tabLogin.className = "w-1/2 py-2 font-semibold text-blue-600 border-b-2 border-blue-600";
  tabRegister.className = "w-1/2 py-2 font-semibold text-gray-500 hover:text-blue-600";
  formLogin.classList.remove('hidden');
  formRegister.classList.add('hidden');
});

tabRegister?.addEventListener('click', () => {
  tabRegister.className = "w-1/2 py-2 font-semibold text-blue-600 border-b-2 border-blue-600";
  tabLogin.className = "w-1/2 py-2 font-semibold text-gray-500 hover:text-blue-600";
  formRegister.classList.remove('hidden');
  formLogin.classList.add('hidden');
});


// --- VALIDACIONES DE NEGOCIO ---
function validarCarne(carne) {
  // Formato: 9999-99-99999
  const regex = /^\d{4}-\d{2}-\d{5}$/;
  return regex.test(carne);
}

function validarPIN(pin) {
  // Solo números
  const regex = /^\d+$/;
  return regex.test(pin);
}


// --- 1. REGISTRO DE ESTUDIANTE ---
formRegister?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const carne = document.getElementById('reg-carne').value.trim();
  const estudiante = document.getElementById('reg-estudiante').value.trim();
  const correo = document.getElementById('reg-correo').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  // Validaciones locales antes de enviar
  if (!validarCarne(carne)) {
    alert('El carné debe tener el formato estricto: 9999-99-99999 (Ej: 1890-20-11489)');
    return;
  }

  if (!validarPIN(password)) {
    alert('La contraseña (PIN) debe contener únicamente números.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/estudiantes/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carne, estudiante, correo, password })
    });

    if (response.ok) {
      alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
      tabLogin.click(); // Cambiar a la pestaña de login
      formRegister.reset();
    } else {
      const errorData = await response.json();
      alert(`Error en el registro: ${errorData.message || 'Datos duplicados o no válidos'}`);
    }
  } catch (error) {
    console.error('Error al registrar:', error);
    alert('Ocurrió un error al conectar con el servidor.');
  }
});


// --- 2. LOGIN ---
formLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const usuario = document.getElementById('login-usuario').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Respuesta login:', data);

      // La API puede devolver el objeto plano o anidado en data.estudiante / data.user / data.data
      const nested = data.estudiante && typeof data.estudiante === 'object' ? data.estudiante : (data.user || data.data || {});
      const base = (nested && typeof nested === 'object' && Object.keys(nested).length ? nested : data);

      // Guardar sesión localmente (el usuario puede ingresar con carné o correo)
      // carne es crítico: los likes/comentarios lo exigen, no debe quedar un correo aquí
      // La API devuelve { estudiante: { carne, nombre, correo } } -> nombre, no estudiante string
      const pickStr = (v) => (typeof v === 'string' && v.trim() ? v : '');
      currentUser = {
        carne: base.carne || data.carne || (usuario.includes('@') ? '' : usuario),
        estudiante: pickStr(base.nombre) || pickStr(base.estudiante) || pickStr(data.nombre) || (typeof data.estudiante === 'string' ? data.estudiante : '') || usuario,
        correo: base.correo || data.correo || (usuario.includes('@') ? usuario : '')
      };

      if (!currentUser.carne) {
        console.warn('Login sin carne en respuesta, se usará fallback. Revisa Network > /login');
        alert('Sesión iniciada pero no se recibió el carné. Si los likes fallan, inicia sesión con tu carné.');
        // Si no hay carne, no guardar sesión incompleta para evitar fallos en interacciones
        if (!usuario.includes('@')) currentUser.carne = usuario;
      }

      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      alert('¡Sesión iniciada correctamente!');
      authModal.classList.add('hidden');
      renderSessionUI();
      location.reload(); // Recargar para actualizar botones e interacciones
    } else {
      alert('Credenciales incorrectas. Verifica tu carné/correo y contraseña.');
    }
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    alert('Ocurrió un error al intentar iniciar sesión.');
  }
});


// --- 3. CATÁLOGO, BÚSQUEDA Y FILTROS ---

const categorySelect = document.getElementById('category-select');
const searchInput = document.getElementById('search-input');
const videoGrid = document.getElementById('video-grid');

// Categorias y catalogos
document.addEventListener('DOMContentLoaded', () => {
  cargarCategorias();
  cargarVideos();
});

// get para obtener listado de categorías
async function cargarCategorias() {
  try {
    const res = await fetch(`${API_BASE}/videos/categorias`);
    if (res.ok) {
      const categorias = await res.json();
      categorias.forEach(cat => {
        const nombreCat = typeof cat === 'object' ? (cat.nombre || cat.categoria) : cat;
        const option = document.createElement('option');
        option.value = nombreCat;
        option.textContent = nombreCat;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar categorías:', error);
  }
}

// obtener videos por categoría o catálogo completo
async function cargarVideos(categoria = '') {
  try {
    let url = `${API_BASE}/videos`;
    if (categoria) {
      url = `${API_BASE}/videos/categoria/${encodeURIComponent(categoria)}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      allVideos = await res.json();
      renderVideos(allVideos);
    } else {
      videoGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-8">No se encontraron videos.</p>`;
    }
  } catch (error) {
    console.error('Error al cargar catálogo de videos:', error);
    videoGrid.innerHTML = `<p class="col-span-full text-center text-red-500 py-8">Error al conectar con la API de videos.</p>`;
  }
}

// mostrar las tarjetas en el HTML
function renderVideos(videos) {
  videoGrid.innerHTML = '';

  if (!videos || videos.length === 0) {
    videoGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 py-8">No hay videos que coincidan con la búsqueda.</p>`;
    return;
  }

  videos.forEach(video => {
    // Normalización de propiedades
    const id = video.id || video.videoId;
    const titulo = video.titulo || video.nombre || 'Sin título';
    const descripcion = video.descripcion || 'Sin descripción';
    const duracion = video.duracion || 'N/A';
    const poster = video.poster || video.imagen || 'https://placehold.co/600x400?text=Video+UMG';

    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md overflow-hidden flex flex-col justify-between hover:shadow-lg transition-shadow';
    
    card.innerHTML = `
      <div>
        <img src="${poster}" alt="${titulo}" class="w-full h-48 object-cover" onerror="this.src='https://placehold.co/600x400?text=Video+UMG'">
        <div class="p-4">
          <div class="flex justify-between items-start mb-2 gap-2">
            <h3 class="font-bold text-lg text-gray-800 line-clamp-2">${titulo}</h3>
            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-semibold whitespace-nowrap">${duracion}</span>
          </div>
          <p class="text-gray-600 text-sm line-clamp-3 mb-4">${descripcion}</p>
        </div>
      </div>
      <div class="p-4 border-t bg-gray-50">
        <button onclick="abrirVideo('${id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors text-center">
          Ver Video e Interactuar
        </button>
      </div>
    `;

    videoGrid.appendChild(card);
  });
}

// búsqueda en tiempo real por palabra clave
searchInput?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const videosFiltrados = allVideos.filter(video => {
    const titulo = (video.titulo || video.nombre || '').toLowerCase();
    return titulo.includes(query);
  });
  renderVideos(videosFiltrados);
});

// filtrar al cambiar la categoría
categorySelect?.addEventListener('change', (e) => {
  const categoria = e.target.value;
  cargarVideos(categoria);
});

// --- 4. REPRODUCTOR DE VIDEOS, LIKES Y COMENTARIOS ---

let currentVideoData = null;

// GET para abril el panel de video y detalles
async function abrirVideo(videoId) {
  const videoModal = document.getElementById('video-modal');
  const modalContent = document.getElementById('video-modal-content');
  
  modalContent.innerHTML = `<div class="text-center py-10"><p class="text-gray-500">Cargando video...</p></div>`;
  videoModal.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}`);
    if (res.ok) {
      currentVideoData = await res.json();
      renderVideoModalContent();
    } else {
      modalContent.innerHTML = `<p class="text-red-500 text-center py-8">No se pudo cargar la información del video.</p>`;
    }
  } catch (error) {
    console.error('Error al obtener detalle del video:', error);
    modalContent.innerHTML = `<p class="text-red-500 text-center py-8">Error de conexión con el servidor.</p>`;
  }
}

function cerrarVideoModal() {
  document.getElementById('video-modal').classList.add('hidden');
  currentVideoData = null;
}

// mostrar contenido de videos, likes, comentarios
function renderVideoModalContent() {
  if (!currentVideoData) return;

  const video = currentVideoData;
  const id = video.id || video.videoId;
  const titulo = video.titulo || video.nombre || 'Sin título';
  const descripcion = video.descripcion || 'Sin descripción';
  const urlVideo = video.urlVideo || video.url || video.videoUrl || '';
  const likesCount = video.likes || video.likesCount || 0;
  const comentarios = video.comentarios || [];

  // verificación de acceso visual para visitante
  const isAuth = currentUser !== null;

  const modalContent = document.getElementById('video-modal-content');
  modalContent.innerHTML = `
    <!-- Reproductor o vista previa -->
    <div class="mb-4 bg-black rounded-lg overflow-hidden max-h-96 flex justify-center items-center">
      ${urlVideo.includes('youtube') || urlVideo.includes('embed') 
        ? `<iframe src="${urlVideo}" class="w-full h-80" frameborder="0" allowfullscreen></iframe>`
        : `<video controls class="w-full max-h-80"><source src="${urlVideo}" type="video/mp4">Tu navegador no soporta el video.</video>`
      }
    </div>

    <!-- Información del Video -->
    <h2 class="text-2xl font-bold text-gray-800 mb-2">${titulo}</h2>
    <p class="text-gray-600 text-sm mb-4">${descripcion}</p>

    <!-- Sección de Reacción (Like Toggle) -->
    <div class="flex items-center gap-4 py-3 border-y mb-6">
      ${isAuth ? `
        <button onclick="toggleLike('${id}')" class="bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold px-4 py-2 rounded-full flex items-center gap-2">
          👍 <span>${likesCount} Likes</span>
        </button>
      ` : `
        <button onclick="cerrarVideoModal(); openAuthModal();" class="bg-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-full flex items-center gap-2">
          🔒 Inicia sesión para dar Me Gusta (${likesCount})
        </button>
      `}
    </div>

    <!-- Sección de Comentarios -->
    <div class="space-y-6">
      <h3 class="text-xl font-bold text-gray-800">Comentarios</h3>

      <!-- Publicar Comentario Principal -->
      ${isAuth ? `
        <div class="flex gap-2">
          <input type="text" id="input-comentario" placeholder="Escribe un comentario..." class="flex-grow px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <button onclick="publicarComentario('${id}')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg">Comentar</button>
        </div>
      ` : `
        <div class="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-sm flex justify-between items-center">
          <span>Debes estar registrado para comentar en este video.</span>
          <button onclick="cerrarVideoModal(); openAuthModal();" class="underline font-bold">Iniciar sesión</button>
        </div>
      `}

      <!-- Lista de Comentarios Anidados -->
      <div class="space-y-4 mt-4">
        ${comentarios.length === 0 ? '<p class="text-gray-500 text-sm">Aún no hay comentarios.</p>' : renderComentariosList(comentarios, id)}
      </div>
    </div>
  `;
}

// mostrar comentarios e hilos de respuesta
function renderComentariosList(comentarios, videoId) {
  const isAuth = currentUser !== null;

  return comentarios.map(c => {
    const cId = c.id || c.comentarioId;
    const autor = c.estudiante || c.carne || 'Estudiante';
    const esMiComentario = isAuth && (c.carne === currentUser.carne);
    const respuestas = c.respuestas || [];

    return `
      <div class="bg-gray-50 p-3 rounded-lg border">
        <div class="flex justify-between items-center mb-1">
          <span class="font-bold text-sm text-gray-800">${autor}</span>
          ${esMiComentario ? `
            <button onclick="eliminarComentario('${cId}', '${videoId}')" class="text-red-500 hover:text-red-700 text-xs font-semibold">Eliminar</button>
          ` : ''}
        </div>
        <p class="text-gray-700 text-sm mb-2">${c.texto}</p>

        <!-- Formulario para Responder (si está autenticado) -->
        ${isAuth ? `
          <div class="flex gap-2 mt-2">
            <input type="text" id="reply-input-${cId}" placeholder="Responder..." class="text-xs px-2 py-1 border rounded w-full">
            <button onclick="responderComentario('${cId}', '${videoId}')" class="bg-gray-700 hover:bg-gray-800 text-white text-xs px-3 py-1 rounded whitespace-nowrap">Responder</button>
          </div>
        ` : ''}

        <!-- Hilos de respuesta (1er nivel de anidamiento) -->
        ${respuestas.length > 0 ? `
          <div class="ml-6 mt-3 space-y-2 border-l-2 border-blue-300 pl-3">
            ${respuestas.map(r => {
              const rId = r.id || r.comentarioId;
              const rAutor = r.estudiante || r.carne || 'Estudiante';
              const esMiRespuesta = isAuth && (r.carne === currentUser.carne);
              return `
                <div class="bg-white p-2 rounded border">
                  <div class="flex justify-between items-center">
                    <span class="font-semibold text-xs text-blue-900">${rAutor}</span>
                    ${esMiRespuesta ? `
                      <button onclick="eliminarComentario('${rId}', '${videoId}')" class="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                    ` : ''}
                  </div>
                  <p class="text-gray-600 text-xs mt-1">${r.texto}</p>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}


// --- POST CONSUMO DE ENDPOINTS DE INTERACCIÓN ---

// post like
async function toggleLike(videoId) {
  if (!currentUser) return;
  if (!currentUser.carne) return alert('Tu sesión no tiene carné. Inicia sesión con tu carné.');

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/${encodeURIComponent(videoId)}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carne: currentUser.carne })
    });

    if (res.ok) {
      abrirVideo(videoId);
    } else {
      alert('Error al procesar el Me Gusta.');
    }
  } catch (error) {
    console.error('Error en Toggle Like:', error);
  }
}

// publicar comentario principal
async function publicarComentario(videoId) {
  if (!currentUser) return;
  const input = document.getElementById('input-comentario');
  const texto = input?.value.trim();

  if (!texto) return alert('Escribe un comentario antes de enviar.');

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/${encodeURIComponent(videoId)}/comentario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carne: currentUser.carne, texto })
    });

    if (res.ok) {
      abrirVideo(videoId);
    } else {
      alert('Error al publicar comentario.');
    }
  } catch (error) {
    console.error('Error al comentar:', error);
  }
}

// responder comentario
async function responderComentario(comentarioId, videoId) {
  if (!currentUser) return;
  const input = document.getElementById(`reply-input-${comentarioId}`);
  const texto = input?.value.trim();

  if (!texto) return alert('Escribe una respuesta antes de enviar.');

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/comentario/${encodeURIComponent(comentarioId)}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carne: currentUser.carne, texto })
    });

    if (res.ok) {
      abrirVideo(videoId);
    } else {
      alert('Error al enviar respuesta.');
    }
  } catch (error) {
    console.error('Error al responder:', error);
  }
}

// eliminar Comentario DELETE
async function eliminarComentario(comentarioId, videoId) {
  if (!currentUser) return;
  if (!confirm('¿Deseas eliminar este comentario?')) return;

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/comentario/${encodeURIComponent(comentarioId)}?carne=${encodeURIComponent(currentUser.carne)}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      abrirVideo(videoId);
    } else if (res.status === 403) {
      alert('Acceso denegado: solo puedes eliminar tus propios comentarios.');
    } else {
      alert('No se pudo eliminar el comentario.');
    }
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
  }
}