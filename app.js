        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
        import { initializeFirestore, persistentLocalCache, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, writeBatch, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
        import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

        // BLOQUEO DE CLICK DERECHO
        document.addEventListener('contextmenu', event => event.preventDefault());

        const firebaseConfig = {
            apiKey: "AIzaSyCtYiB82SKyGGbjeh8iZCzSefkC5H1_NTs",
            authDomain: "pdv-raspaditomx.firebaseapp.com",
            projectId: "pdv-raspaditomx",
            storageBucket: "pdv-raspaditomx.firebasestorage.app",
            messagingSenderId: "110249134810",
            appId: "1:110249134810:web:66f1765db51b9f3d8b73e3"
        };
        const app = initializeApp(firebaseConfig);
        const db = initializeFirestore(app, {
            localCache: persistentLocalCache()
        });
        const auth = getAuth(app);

        // --- CONFIGURACIÓN ADMIN ---
        const ADMIN_EMAILS = [
            'admin@raspadito.com'
        ];

        window.currentRole = null;
        let unsubscribeProd = null;
        let unsubscribeVentas = null;

        const lastEmail = localStorage.getItem('lastEmail');
        if(lastEmail) document.getElementById('login-email').value = lastEmail;

        window.checkLogin = async () => {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const statusLabel = document.getElementById('login-status');
            const errorLabel = document.getElementById('login-error');
            
            if(!email || !password) return;

            statusLabel.innerText = "Verificando...";
            errorLabel.style.display = 'none';
            
            try {
                await signInWithEmailAndPassword(auth, email, password);
                localStorage.setItem('lastEmail', email);
            } catch (error) {
                console.error(error);
                statusLabel.innerText = "Error";
                errorLabel.innerText = "Datos incorrectos";
                errorLabel.style.display = 'block';
            }
        };

        document.getElementById('login-password').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') window.checkLogin();
        });

        onAuthStateChanged(auth, (user) => {
            if (user) {
                document.getElementById('login-overlay').style.display = 'none';
                if(ADMIN_EMAILS.includes(user.email)) {
                    window.currentRole = 'admin';
                } else {
                    window.currentRole = 'worker';
                }
                aplicarPermisos(window.currentRole);
                navegar('pos');
                iniciarEscuchas();
            } else {
                document.getElementById('login-overlay').style.display = 'flex';
                window.currentRole = null;
                document.getElementById('login-password').value = '';
                detenerEscuchas();
            }
        });

        function iniciarEscuchas() {
            if(!unsubscribeProd) {
                const qProd = query(collection(db, "productos"), orderBy("orden", "asc"));
                unsubscribeProd = onSnapshot(qProd, (snapshot) => {
                    window.productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    window.cargarTablaProductos(); window.renderizarPOS();
                    document.getElementById('loader-overlay').style.display = 'none';
                }, (error) => { console.error("Error productos:", error); });
            }
            if(!unsubscribeVentas) {
                const qVentas = query(collection(db, "ventas"));
                unsubscribeVentas = onSnapshot(qVentas, (snapshot) => {
                    window.ventas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if(document.getElementById('vista-diarias').classList.contains('seccion-activa')) window.cargarReporteDiario();
                    if(document.getElementById('vista-generales').classList.contains('seccion-activa')) window.cargarReporteGeneral();
                    if(document.getElementById('vista-especificas').classList.contains('seccion-activa')) window.cargarVentasEspecificas();
                }, (error) => { console.error("Error ventas:", error); });
            }
        }

        function detenerEscuchas() {
            if(unsubscribeProd) { unsubscribeProd(); unsubscribeProd = null; }
            if(unsubscribeVentas) { unsubscribeVentas(); unsubscribeVentas = null; }
            window.productos = []; window.ventas = [];
        }


        // --- SISTEMA DE SEGURIDAD PARA CERRAR SESIÓN ---
        const NIP_MAESTRO = "5253"; //

        window.cerrarSesion = () => {
            // Protección #1: Advertencia si no hay internet
            if (!navigator.onLine) {
                const advertencia = confirm("⚠️ ¡ALERTA DE DESCONEXIÓN! ⚠️\n\nEl sistema no tiene internet en este momento. Si cierras sesión AHORA, NO podrás volver a entrar al sistema hasta que regrese el internet.\n\n¿Estás absolutamente seguro de que quieres continuar?");
                if (!advertencia) return; // Si le dan cancelar, se aborta
            }

            // Abrimos el modal y limpiamos intentos anteriores
            document.getElementById('nip-input').value = '';
            document.getElementById('nip-error').style.display = 'none';
            const modalNip = new bootstrap.Modal(document.getElementById('modalNip'));
            modalNip.show();
        };

        window.confirmarCerrarSesion = () => {
            const nipIngresado = document.getElementById('nip-input').value;
            
            if (nipIngresado === NIP_MAESTRO) {
                // NIP Correcto: Cerramos sesión
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalNip'));
                modal.hide();
                
                window.carrito = []; 
                window.montoRecibido = ""; 
                window.actualizarTicket(); 
                
                signOut(auth).then(() => { 
                    location.reload(); 
                });
            } else {
                // NIP Incorrecto: Mostramos error
                document.getElementById('nip-error').style.display = 'block';
                document.getElementById('nip-input').value = '';
            }
        };

        function aplicarPermisos(role) {
            const badge = document.getElementById('role-badge');
            const restrictedItems = document.querySelectorAll('.restricted');
            if(role === 'admin') {
                badge.className = 'badge bg-danger me-2'; badge.innerText = 'ADMIN';
                restrictedItems.forEach(el => el.classList.remove('hidden-worker'));
            } else {
                badge.className = 'badge bg-success me-2'; badge.innerText = 'VENTA';
                restrictedItems.forEach(el => el.classList.add('hidden-worker'));
            }
        }

        window.switchMobileTab = (tab) => {
            const pProd = document.getElementById('panel-productos');
            const pTicket = document.getElementById('panel-ticket');
            const btnProd = document.getElementById('tab-prod');
            const btnTicket = document.getElementById('tab-ticket');
            const keypad = document.getElementById('floating-keypad');

            if(tab === 'prod') {
                pProd.classList.add('show-mobile');
                pTicket.classList.remove('show-mobile-flex');
                btnProd.classList.add('active');
                btnTicket.classList.remove('active');
                keypad.classList.add('keypad-hidden-mobile');
            } else {
                pProd.classList.remove('show-mobile');
                pTicket.classList.add('show-mobile-flex');
                btnProd.classList.remove('active');
                btnTicket.classList.add('active');
                if(window.innerWidth <= 768) { pTicket.appendChild(keypad); keypad.classList.remove('keypad-hidden-mobile'); }
            }
        };
        window.switchMobileTab('prod');

        window.productos = []; window.ventas = []; window.carrito = []; window.montoRecibido = "";
        window.chartDia = null; window.chartEsp = null; window.editId = null; window.isLayoutLocked = false;

        window.fechaLocalCorta = (isoString) => { if(!isoString) return ""; const fecha = new Date(isoString); const year = fecha.getFullYear(); const month = String(fecha.getMonth() + 1).padStart(2, '0'); const day = String(fecha.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
        window.getContrastYIQ = (hex) => { hex = hex.replace("#", ""); var r = parseInt(hex.substr(0,2),16); var g = parseInt(hex.substr(2,2),16); var b = parseInt(hex.substr(4,2),16); return (((r*299)+(g*587)+(b*114))/1000) >= 128 ? 'black' : 'white'; };
        
        window.navegar = (vista) => {
            if(window.currentRole === 'worker' && vista !== 'pos') return alert("Acceso restringido a Vendedores");
            document.querySelectorAll('.seccion-app').forEach(s => s.classList.remove('seccion-activa'));
            document.getElementById('vista-' + vista).classList.add('seccion-activa');
            const offcanvas = document.getElementById('menuLateral');
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
            if(bsOffcanvas) bsOffcanvas.hide();
            const titulos = { 'pos': 'Punto de Venta', 'productos': 'Inventario', 'diarias': 'Reporte Diario', 'especificas': 'Ventas Específicas', 'generales': 'Historial', 'exportar': 'Descargas' };
            document.getElementById('titulo-vista').innerText = titulos[vista];
            const keypad = document.getElementById('floating-keypad');
            const mobileTabs = document.querySelector('.mobile-tabs-container');
            if (vista === 'pos') { keypad.style.display = 'flex'; document.body.appendChild(keypad); window.switchMobileTab('prod'); if(window.innerWidth <= 768) mobileTabs.style.display = 'flex'; } else { keypad.style.display = 'none'; mobileTabs.style.display = 'none'; }
            if(vista === 'productos') window.cargarTablaProductos();
            if(vista === 'diarias') window.cargarReporteDiario();
        };

        window.toggleLayoutLock = () => { window.isLayoutLocked = !window.isLayoutLocked; const btn = document.getElementById('btn-lock-layout'); const h = document.querySelector('.resizer-h'); if(window.isLayoutLocked) { btn.innerHTML = '<i class="fa-solid fa-lock"></i>'; btn.className = "btn btn-sm btn-warning"; h.classList.add('resizer-locked'); } else { btn.innerHTML = '<i class="fa-solid fa-lock-open"></i>'; btn.className = "btn btn-sm btn-outline-warning"; h.classList.remove('resizer-locked'); } };
        const resizerH = document.querySelector('.resizer-h'); const panelTicket = document.querySelector('.panel-ticket'); let isResizingH = false; const startH = (e) => { if(window.isLayoutLocked) return; isResizingH = true; e.preventDefault(); }; resizerH.addEventListener('mousedown', startH); resizerH.addEventListener('touchstart', startH, {passive: false}); const handleMove = (e) => { if(!isResizingH) return; const clientX = e.clientX || (e.touches && e.touches[0].clientX); if(isResizingH && clientX) { e.preventDefault(); const newWidth = window.innerWidth - clientX; if(newWidth > 200 && newWidth < window.innerWidth - 100) panelTicket.style.width = newWidth + 'px'; } }; const handleEnd = () => { isResizingH = false; }; document.addEventListener('mousemove', handleMove); document.addEventListener('touchmove', handleMove, {passive: false}); document.addEventListener('mouseup', handleEnd); document.addEventListener('touchend', handleEnd);
        const keypad = document.getElementById("floating-keypad"); const header = document.getElementById("keypad-header"); const resizerKey = document.getElementById("resize-handle"); const savedPos = JSON.parse(localStorage.getItem("posTeclado")); if (savedPos && window.innerWidth > 768) { keypad.style.left = savedPos.left; keypad.style.top = savedPos.top; keypad.style.width = savedPos.width; keypad.style.height = savedPos.height; } let isDragK = false, startXK, startYK, initLeftK, initTopK; const startDragK = (e) => { if(window.innerWidth <= 768) return; isDragK = true; startXK = e.clientX || e.touches[0].clientX; startYK = e.clientY || e.touches[0].clientY; const rect = keypad.getBoundingClientRect(); initLeftK = rect.left; initTopK = rect.top; e.preventDefault(); }; const moveDragK = (e) => { if(!isDragK) return; e.preventDefault(); const cx = e.clientX || e.touches[0].clientX; const cy = e.clientY || e.touches[0].clientY; keypad.style.left = (initLeftK + cx - startXK) + 'px'; keypad.style.top = (initTopK + cy - startYK) + 'px'; keypad.style.right = 'auto'; keypad.style.bottom = 'auto'; }; let isResizeK = false, startWK, startHK; const startResizeK = (e) => { if(window.innerWidth <= 768) return; isResizeK = true; startXK = e.clientX || e.touches[0].clientX; startYK = e.clientY || e.touches[0].clientY; startWK = parseInt(getComputedStyle(keypad).width); startHK = parseInt(getComputedStyle(keypad).height); e.stopPropagation(); e.preventDefault(); }; const moveResizeK = (e) => { if(!isResizeK) return; e.preventDefault(); const cx = e.clientX || e.touches[0].clientX; const cy = e.clientY || e.touches[0].clientY; keypad.style.width = (startWK + cx - startXK) + 'px'; keypad.style.height = (startHK + cy - startYK) + 'px'; }; const stopAllK = () => { if(isDragK || isResizeK) { localStorage.setItem("posTeclado", JSON.stringify({ left: keypad.style.left, top: keypad.style.top, width: keypad.style.width, height: keypad.style.height })); } isDragK = false; isResizeK = false; }; header.addEventListener('mousedown', startDragK); header.addEventListener('touchstart', startDragK, {passive:false}); resizerKey.addEventListener('mousedown', startResizeK); resizerKey.addEventListener('touchstart', startResizeK, {passive:false}); document.addEventListener('mousemove', (e) => { moveDragK(e); moveResizeK(e); }); document.addEventListener('touchmove', (e) => { moveDragK(e); moveResizeK(e); }, {passive:false}); document.addEventListener('mouseup', stopAllK); document.addEventListener('touchend', stopAllK);

        // --- SISTEMA DE BURBUJAS (CATEGORÍAS) ---
        window.categoriaActual = null;

        window.abrirBurbuja = (catNombre) => {
            window.categoriaActual = catNombre;
            const burbuja = document.getElementById('burbuja-productos');
            if(!burbuja) return;
            burbuja.innerHTML = '';
            
            // Filtrar productos que contengan esta categoría en su arreglo
            const prods = window.productos.filter(p => {
                const pCats = p.categorias || (p.categoria ? [p.categoria.toUpperCase()] : ['GENERAL']);
                return pCats.map(c => c.toUpperCase()).includes(catNombre);
            });
            
            prods.forEach(p => { 
                const itemEnCarrito = window.carrito.find(i => i.id === p.id); 
                const badgeHTML = itemEnCarrito ? `<div class="qty-badge">${itemEnCarrito.cantidad}</div>` : ''; 
                burbuja.innerHTML += `<button class="btn-producto" style="background-color:${p.color}; color:#ffffff; text-shadow: 1px 1px 3px rgba(0,0,0,0.6); border:none;" onclick="agregar('${p.id}')">${badgeHTML}<span class="small text-uppercase opacity-75">${p.nombre}</span><span class="fs-4 mb-0">$${p.precio}</span></button>`; 
            });
            
            document.getElementById('overlay-categorias').style.display = 'flex';
        };

        window.cerrarBurbuja = () => {
            window.categoriaActual = null;
            document.getElementById('overlay-categorias').style.display = 'none';
        };
        
        window.agregar = (id) => { const p = window.productos.find(x => x.id === id); const i = window.carrito.find(x => x.id === id); if(i) i.cantidad++; else window.carrito.push({...p, cantidad:1}); window.actualizarTicket(); }; window.modCant = (idx, n) => { window.carrito[idx].cantidad += n; if(window.carrito[idx].cantidad <= 0) window.carrito.splice(idx, 1); window.actualizarTicket(); }; window.limpiarTicket = () => { if(window.carrito.length > 0 && confirm('¿Borrar todo?')) { window.carrito = []; window.montoRecibido = ""; window.actualizarTicket(); } else { window.montoRecibido = ""; window.actualizarTicket(); } }; window.actualizarTicket = () => { window.renderizarPOS(); const lista = document.getElementById('ticket-lista'); if(!lista) return; lista.innerHTML = ''; let total = 0, count = 0; window.carrito.forEach((item, idx) => { total += item.precio * item.cantidad; count += item.cantidad; lista.innerHTML += `<div class="d-flex justify-content-between align-items-center border-bottom py-2 px-2" style="font-size:0.9rem"><div style="width:40%"><div class="fw-bold text-truncate">${item.nombre}</div><small class="text-muted">$${item.precio}</small></div><div class="bg-light rounded border"><button class="btn btn-sm btn-ajuste text-danger fw-bold" onclick="modCant(${idx},-1)">-</button><span class="mx-2 fw-bold">${item.cantidad}</span><button class="btn btn-sm btn-ajuste text-success fw-bold" onclick="modCant(${idx},1)">+</button></div><div class="fw-bold text-end" style="width:20%">$${item.precio*item.cantidad}</div></div>`; }); document.getElementById('items-count').innerText = count; document.getElementById('txt-total').innerText = '$' + total; document.getElementById('keypad-total-info').innerText = 'Total: $' + total; const badgeMobile = document.getElementById('tab-total-badge'); if(badgeMobile) badgeMobile.innerText = '$' + total; const rec = parseInt(window.montoRecibido || 0); const lblRec = window.montoRecibido ? '$' + rec : '-'; document.getElementById('txt-recibido-main').innerText = 'Recibido: ' + lblRec; document.getElementById('keypad-input').innerText = lblRec; let lblCambio = "$0"; let claseColor = "text-secondary"; if (window.montoRecibido) { if (rec < total) { lblCambio = "FALTA $" + (total - rec); claseColor = "text-danger fw-bold"; } else { lblCambio = "$" + (rec - total); claseColor = "text-success fw-bold"; } } document.getElementById('txt-cambio-main').innerText = 'Cambio: ' + lblCambio; const elKey = document.getElementById('keypad-cambio-info'); elKey.innerText = 'Cambio: ' + lblCambio; elKey.className = claseColor; }; window.teclado = (n) => { window.montoRecibido += n; window.actualizarTicket(); }; window.borrarInput = () => { window.montoRecibido = ""; window.actualizarTicket(); }; 
        window.cobrar = () => { 
            const total = window.carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0); 
            if(total === 0) return; 
            
            let pago = parseInt(window.montoRecibido || total); 
            if(window.montoRecibido && pago < total) return alert("Pago insuficiente"); 

            // 1. Copia exacta de los datos del ticket para mandarlos a la nube
            const datosVenta = { 
                fecha: new Date().toISOString(), 
                items: JSON.parse(JSON.stringify(window.carrito)), // Clona los productos
                total: total, 
                pago: pago, 
                vendedor: window.currentRole 
            }; 

            // 2. Limpiamos la pantalla INMEDIATAMENTE para el próximo cliente
            window.carrito = []; 
            window.montoRecibido = ""; 
            window.actualizarTicket(); 

            // 3. Feedback visual (El botón dice ¡GUARDADO!)
            const b = document.querySelector('#btn-cobrar-key'); 
            const o = b.innerHTML; 
            b.innerHTML = '¡GUARDADO!'; 
            setTimeout(() => b.innerHTML = o, 1000); 

            // 4. Se manda a Firebase en "Segundo Plano" (sin trabar la pantalla)
            addDoc(collection(db, "ventas"), datosVenta).catch(e => console.error("Error guardando:", e)); 
        };
        window.cargarTablaProductos = () => { const b = document.getElementById('tabla-productos-body'); if(!b) return; b.innerHTML = ''; window.productos.forEach(p => { b.innerHTML += `<tr data-id="${p.id}"><td class="handle-drag"><i class="fa-solid fa-grip-vertical"></i></td><td><div style="width:25px;height:25px;background:${p.color};border-radius:50%"></div></td><td>${p.nombre}</td><td>$${p.precio}</td><td class="text-end"><button class="btn btn-sm btn-light border me-1" onclick="editarProd('${p.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm btn-outline-danger border" onclick="eliminarProductoDirecto('${p.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`; }); if(b.sortableInstance) b.sortableInstance.destroy(); b.sortableInstance = new Sortable(b, { handle: '.handle-drag', animation: 150, onEnd: function() { actualizarOrdenProductos(); } }); }; async function actualizarOrdenProductos() { const rows = document.querySelectorAll('#tabla-productos-body tr'); const batch = writeBatch(db); rows.forEach((row, index) => { const id = row.getAttribute('data-id'); const ref = doc(db, "productos", id); batch.update(ref, { orden: index }); }); try { await batch.commit(); } catch(e) { console.error(e); } } window.eliminarProductoDirecto = async (id) => { if(confirm('¿Borrar producto?')) { try { await deleteDoc(doc(db, "productos", id)); } catch(e) { alert(e.message); } } }; 

        window.abrirModalProducto = () => { 
            window.editId = null; 
            
            // Desmarcar todas las casillas al crear uno nuevo
            document.querySelectorAll('.cat-checkbox').forEach(chk => chk.checked = false);
            
            document.getElementById('prod-nombre').value = ''; 
            document.getElementById('prod-precio').value = ''; 
            document.getElementById('prod-color').value = '#8b5cf6'; // O el color de tu sucursal
            document.getElementById('btn-del-prod').style.display = 'none'; 
            
            const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
            modal.show(); 
        }; 

        window.editarProd = (id) => { 
            const p = window.productos.find(x => x.id === id); 
            window.editId = id; 
            
            // Retrocompatibilidad: Lee el formato nuevo (array) o el viejo (string)
            const catsDelProducto = p.categorias || (p.categoria ? [p.categoria] : []);
            
            document.querySelectorAll('.cat-checkbox').forEach(chk => {
                chk.checked = catsDelProducto.includes(chk.value);
            });
            
            document.getElementById('prod-nombre').value = p.nombre; 
            document.getElementById('prod-precio').value = p.precio; 
            document.getElementById('prod-color').value = p.color; 
            document.getElementById('btn-del-prod').style.display = 'block'; 
            
            const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
            modal.show(); 
        }; 

        window.guardarProducto = async () => { 
            // Recopilar todos los checkboxes que estén marcados
            const checkboxes = document.querySelectorAll('.cat-checkbox:checked');
            const categoriasArray = Array.from(checkboxes).map(chk => chk.value);
            
            const n = document.getElementById('prod-nombre').value; 
            const pr = parseFloat(document.getElementById('prod-precio').value); 
            const c = document.getElementById('prod-color').value; 
            
            if(!n || !pr || categoriasArray.length === 0) return alert("Llena nombre, precio y al menos 1 categoría"); 
            
            try { 
                // Guardamos el arreglo en el campo "categorias" (plural)
                const data = { categorias: categoriasArray, nombre: n, precio: pr, color: c };
                if(window.editId) {
                    await updateDoc(doc(db, "productos", window.editId), data); 
                } else { 
                    await addDoc(collection(db, "productos"), { ...data, orden: window.productos.length }); 
                } 
                bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            } catch (e) { alert("Error: " + e.message); } 
        };

        window.eliminarProducto = async () => { if(confirm('¿Eliminar?')) { try { await deleteDoc(doc(db, "productos", window.editId)); modal.hide(); } catch(e) { alert(e.message); } } }; 
        const modal = new bootstrap.Modal(document.getElementById('modalProducto')); 
        
        // --- FUNCIÓN MODIFICADA: RANGO DE FECHAS ---
        window.cargarVentasEspecificas = () => {
            const ini = document.getElementById('filtro-esp-inicio').value;
            const fin = document.getElementById('filtro-esp-fin').value;
            
            if(!ini || !fin) return alert("Selecciona un rango de fechas.");

            // Filtro por rango
            const ventasRango = window.ventas.filter(v => {
                const f = window.fechaLocalCorta(v.fecha);
                return f >= ini && f <= fin;
            });

            document.getElementById('contenido-especifico').style.display = 'block';
            
            const totalDinero = ventasRango.reduce((sum, v) => sum + (v.total || 0), 0);
            document.getElementById('total-dia-esp').innerText = '$' + totalDinero;
            document.getElementById('titulo-dia-esp').innerText = 'Resumen: ' + ini + ' al ' + fin;

            // GRAFICO (Acumulado por horas en el rango)
            const ctx = document.getElementById('graficoEspecifico');
            const labels = ["12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm","10pm","11pm"];
            const data = Array(12).fill(0);
            
            ventasRango.forEach(v => {
                const h = new Date(v.fecha).getHours();
                if(h >= 12) {
                    const idx = h - 12;
                    if(idx < 12) data[idx] += (v.total || 0);
                }
            });

            if(window.chartEsp) window.chartEsp.destroy();
            window.chartEsp = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Venta Acumulada ($)',
                        data: data,
                        backgroundColor: '#198754',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });

            // TABLA RANKING
            const resumenProductos = {};
            ventasRango.forEach(v => {
                (v.items || []).forEach(item => {
                    const n = item.nombre || "Desc";
                    if(!resumenProductos[n]) resumenProductos[n] = { cant: 0, total: 0 };
                    resumenProductos[n].cant += (item.cantidad || 0);
                    resumenProductos[n].total += (item.precio * item.cantidad);
                });
            });

            const ranking = Object.keys(resumenProductos).map(key => ({
                nombre: key,
                ...resumenProductos[key]
            })).sort((a, b) => b.cant - a.cant);

            const tbody = document.getElementById('tabla-productos-esp');
            tbody.innerHTML = '';
            
            if(ranking.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">Sin ventas en este periodo</td></tr>';
            } else {
                ranking.forEach(p => {
                    tbody.innerHTML += `<tr><td>${p.nombre}</td><td class="text-center fw-bold">${p.cant}</td><td class="text-end text-success">$${p.total}</td></tr>`;
                });
            }
        };

        window.eliminarTicket = async (idVenta) => { if(confirm("¿Eliminar ticket?")) try { await deleteDoc(doc(db, "ventas", idVenta)); } catch(e){alert(e.message);} }; window.toggleDetalle = (id) => { const el = document.getElementById(id); if(el) el.classList.toggle('fila-activa'); }; window.toggleCollapse = (id) => { const el = document.getElementById(id); if(el) el.classList.toggle('show'); }; window.modificarVentaPasada = async (idVenta, idxItem, cambio) => { const venta = window.ventas.find(v => v.id === idVenta); if(!venta) return; const nuevosItems = [...venta.items]; const item = nuevosItems[idxItem]; item.cantidad += cambio; if(item.cantidad <= 0) nuevosItems.splice(idxItem, 1); try { if(nuevosItems.length === 0) await deleteDoc(doc(db, "ventas", idVenta)); else { const nuevoTotal = nuevosItems.reduce((sum, i) => sum + (i.precio * i.cantidad), 0); await updateDoc(doc(db, "ventas", idVenta), { items: nuevosItems, total: nuevoTotal }); } } catch(e) { alert(e.message); } }; function generarHTMLTickets(listaVentas, prefijoId) { if(!listaVentas || listaVentas.length === 0) return '<tr><td colspan="3" class="text-center text-muted p-3">Sin ventas</td></tr>'; let html = ''; const listaOrdenada = listaVentas.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).reverse(); listaOrdenada.forEach(v => { const fechaObj = new Date(v.fecha); const hora = fechaObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); const idFila = prefijoId + '-' + v.id; const itemsSafe = v.items || []; const resumen = itemsSafe.length > 0 ? itemsSafe.map(i => (i.cantidad || 0) + 'x ' + (i.nombre || '???')).join(', ') : '<span class="text-danger">Datos antiguos</span>'; const btnEliminar = window.currentRole === 'admin' ? `<button class="btn btn-outline-danger btn-sm ms-3 py-0 px-2" onclick="event.stopPropagation(); eliminarTicket('${v.id}')"><i class="fa-solid fa-trash"></i></button>` : ''; html += `<tr class="cursor-pointer bg-white border-bottom" onclick="toggleDetalle('${idFila}')"><td class="fw-bold text-secondary" style="width:20%">${hora}</td><td class="small text-muted text-truncate" style="max-width:150px">${resumen}</td><td class="fw-bold text-end d-flex justify-content-end align-items-center"><span>$${(v.total||0)}</span>${btnEliminar}</td></tr>`; html += `<tr id="${idFila}" class="fila-detalle"><td colspan="3" class="p-0 bg-light"><div class="p-3 border-bottom"><p class="small fw-bold mb-2 text-primary">Editar Productos:</p>`; if(window.currentRole === 'admin') { if(itemsSafe.length > 0) { html += '<ul class="list-group">'; itemsSafe.forEach((item, idxItem) => { html += `<li class="list-group-item d-flex justify-content-between align-items-center p-2"><span>${(item.nombre||"?")} <small class="text-muted">($${(item.precio||0)})</small></span><div><button class="btn btn-outline-danger btn-sm py-0 px-2 me-2" onclick="modificarVentaPasada('${v.id}', ${idxItem}, -1)">-</button><span class="fw-bold">${(item.cantidad||0)}</span><button class="btn btn-outline-success btn-sm py-0 px-2 ms-2" onclick="modificarVentaPasada('${v.id}', ${idxItem}, 1)">+</button></div></li>`; }); html += '</ul>'; } else { html += '<p class="text-muted small">Ticket no editable.</p>'; } } else { html += '<p class="text-muted small fst-italic">Solo Admin puede editar ventas pasadas.</p>'; } html += '</div></td></tr>'; }); return html; } window.cargarReporteDiario = () => { const hoyStr = window.fechaLocalCorta(new Date().toISOString()); const ventasHoy = window.ventas.filter(v => window.fechaLocalCorta(v.fecha) === hoyStr); const total = ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0); document.getElementById('reporte-total-hoy').innerText = '$' + total; document.getElementById('reporte-conteo-hoy').innerText = ventasHoy.length; document.getElementById('tbody-ventas-hoy').innerHTML = generarHTMLTickets(ventasHoy, 'dia'); generarGraficaHoras(ventasHoy); }; window.cargarReporteGeneral = () => { const ini = document.getElementById('filtro-inicio').value; const fin = document.getElementById('filtro-fin').value; const div = document.getElementById('contenedor-historial'); if(!ini || !fin) return; const filtradas = window.ventas.filter(v => { const f = window.fechaLocalCorta(v.fecha); return f >= ini && f <= fin; }); if(filtradas.length === 0) { div.innerHTML = '<div class="alert alert-light text-center border">No hay ventas.</div>'; return; } const grupos = {}; filtradas.forEach(v => { const dia = window.fechaLocalCorta(v.fecha); if(!grupos[dia]) grupos[dia] = []; grupos[dia].push(v); }); let html = '<div class="accordion">'; Object.keys(grupos).sort().reverse().forEach(dia => { const lista = grupos[dia]; const totalDia = lista.reduce((s, v) => s + (v.total || 0), 0); const fechaTexto = new Date(dia + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'short', day:'numeric', month:'short'}); const idCollapse = 'collapse-' + dia; html += `<div class="card mb-2 border-0 shadow-sm"><div class="card-header bg-white d-flex justify-content-between align-items-center py-3 cursor-pointer dia-header" onclick="toggleCollapse('${idCollapse}')"><div><h6 class="mb-0 fw-bold text-uppercase">${fechaTexto}</h6><small class="text-muted">${lista.length} tickets</small></div><h5 class="mb-0 fw-bold text-success">$${totalDia}</h5></div><div id="${idCollapse}" class="collapse"><div class="card-body p-0"><table class="table mb-0"><tbody class="bg-light">${generarHTMLTickets(lista, 'gen-'+dia)}</tbody></table></div></div></div>`; }); html += '</div>'; div.innerHTML = html; }; function generarGraficaHoras(datos) { const ctx = document.getElementById('graficoDia'); const labels = ["12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm","10pm","11pm"]; const data = Array(12).fill(0); datos.forEach(v => { const h = new Date(v.fecha).getHours(); if(h >= 12) { const idx = h - 12; if(idx < 12) data[idx] += (v.total || 0); } }); if(window.chartDia) window.chartDia.destroy(); window.chartDia = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Venta ($)', data: data, backgroundColor: '#0d6efd', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } }); } window.descargarExcel = () => { const ini = document.getElementById('exp-inicio').value; const fin = document.getElementById('exp-fin').value; if(!ini || !fin) return alert("Selecciona fechas"); const rep = window.ventas.filter(v => { const f = window.fechaLocalCorta(v.fecha); return f >= ini && f <= fin; }); if(rep.length === 0) return alert("Sin datos"); const filas = []; rep.forEach(v => { const itemsSafe = v.items || []; const fechaLocal = new Date(v.fecha).toLocaleDateString(); const horaLocal = new Date(v.fecha).toLocaleTimeString(); const vendedor = v.vendedor ? (v.vendedor === 'admin' ? 'Admin' : 'Empleado') : 'N/A'; if(itemsSafe.length === 0) { filas.push({ "ID": v.id, "Fecha": fechaLocal, "Hora": horaLocal, "Vendedor": vendedor, "Prod": "BORRADO", "Total": 0 }); } else { itemsSafe.forEach(i => { filas.push({ "ID": v.id, "Fecha": fechaLocal, "Hora": horaLocal, "Vendedor": vendedor, "Prod": i.nombre, "Precio": i.precio, "Cant": i.cantidad, "Total": i.precio*i.cantidad }); }); } }); const ws = XLSX.utils.json_to_sheet(filas); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ventas"); XLSX.writeFile(wb, `Ventas_${ini}_${fin}.xlsx`); }; const hoy = window.fechaLocalCorta(new Date().toISOString()); document.querySelectorAll('input[type="date"]').forEach(i => i.value = hoy);
    
    // --- GESTIÓN DE CATEGORÍAS (NJS SYSTEM) ---
        let unsubscribeCat = null;
        window.categorias = [];
        const modalCat = new bootstrap.Modal(document.getElementById('modalCategoria'));

        // 1. Escucha en tiempo real de Categorías
        function iniciarEscuchaCategorias() {
            if(!unsubscribeCat) {
                const qCat = query(collection(db, "categorias"), orderBy("orden", "asc"));
                unsubscribeCat = onSnapshot(qCat, (snapshot) => {
                    window.categorias = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderizarInventarioCategorias();
                    actualizarSelectCategorias(); // Llena el dropdown del modal productos
                    window.renderizarPOS();       // Actualiza los botones de venta
                });
            }
        }
        // Llama a esta función dentro de tu onAuthStateChanged cuando el usuario esté logueado
        iniciarEscuchaCategorias();

        // --- LÓGICA DEL MODAL DE CATEGORÍAS ---
        window.renderizarCheckboxesProductos = (catNombre = '') => {
            const container = document.getElementById('cat-productos-container');
            if(!container) return;
            container.innerHTML = '';

            if(window.productos.length === 0) {
                container.innerHTML = '<div class="small text-muted">No hay productos aún.</div>';
                return;
            }

            // Pinta todos los productos y marca los que ya pertenecen a esta categoría
            window.productos.forEach(p => {
                const pCats = p.categorias || (p.categoria ? [p.categoria.toUpperCase()] : []);
                const isChecked = catNombre ? pCats.map(c => c.toUpperCase()).includes(catNombre.toUpperCase()) : false;

                container.innerHTML += `
                    <div class="form-check border-bottom pb-1 mb-1">
                        <input class="form-check-input prod-checkbox-in-cat" type="checkbox" value="${p.id}" id="chk-prod-${p.id}" ${isChecked ? 'checked' : ''}>
                        <label class="form-check-label small w-100" for="chk-prod-${p.id}">${p.nombre}</label>
                    </div>
                `;
            });
        };

        window.abrirModalCategoria = () => {
            window.editCatId = null;
            document.getElementById('cat-nombre-viejo').value = '';
            document.getElementById('cat-nombre-input').value = '';
            document.getElementById('cat-color-input').value = '#4c1d95';
            document.getElementById('btn-del-cat').style.display = 'none';
            renderizarCheckboxesProductos(''); // Muestra todos desmarcados
            modalCat.show();
        };

        window.editarCat = (id) => {
            const c = window.categorias.find(x => x.id === id);
            window.editCatId = id;
            document.getElementById('cat-nombre-viejo').value = c.nombre; 
            document.getElementById('cat-nombre-input').value = c.nombre;
            document.getElementById('cat-color-input').value = c.color;
            document.getElementById('btn-del-cat').style.display = 'block';
            renderizarCheckboxesProductos(c.nombre); // Marca los que correspondan
            modalCat.show();
        };

        window.guardarCategoria = async () => {
            const nom = document.getElementById('cat-nombre-input').value.toUpperCase();
            const col = document.getElementById('cat-color-input').value;
            const nomViejo = document.getElementById('cat-nombre-viejo').value.toUpperCase();

            if(!nom) return alert("Escribe un nombre para la categoría");

            try {
                // 1. Guardar la Categoría en sí misma
                if(window.editCatId) await updateDoc(doc(db, "categorias", window.editCatId), { nombre: nom, color: col });
                else await addDoc(collection(db, "categorias"), { nombre: nom, color: col, orden: window.categorias.length });

                // 2. Actualizar los productos seleccionados (Batch Update)
                const batch = writeBatch(db);
                let hasUpdates = false;

                document.querySelectorAll('.prod-checkbox-in-cat').forEach(chk => {
                    const prodId = chk.value;
                    const isChecked = chk.checked;
                    const p = window.productos.find(x => x.id === prodId);
                    let pCats = p.categorias || (p.categoria ? [p.categoria.toUpperCase()] : []);

                    // Si renombraste la categoría, borramos el nombre viejo del producto
                    if(nomViejo && nom !== nomViejo) pCats = pCats.filter(c => c.toUpperCase() !== nomViejo);

                    const alreadyHasIt = pCats.map(c => c.toUpperCase()).includes(nom);
                    let needsUpdate = false;

                    // Lógica para agregar o quitar la categoría del producto según el checkbox
                    if(isChecked && !alreadyHasIt) {
                        pCats.push(nom); 
                        needsUpdate = true;
                    } else if(!isChecked && alreadyHasIt) {
                        pCats = pCats.filter(c => c.toUpperCase() !== nom); 
                        needsUpdate = true;
                    } else if (nomViejo && nom !== nomViejo && pCats.includes(nom)) {
                        needsUpdate = true; // Forzar guardado si se renombró
                    }

                    if(needsUpdate) {
                        batch.update(doc(db, "productos", prodId), { categorias: pCats });
                        hasUpdates = true;
                    }
                });

                if(hasUpdates) await batch.commit(); // Ejecuta todas las actualizaciones de golpe
                modalCat.hide();
            } catch(e) { alert("Error: " + e.message); }
        };

        window.eliminarCategoria = async () => {
            if(!window.editCatId) return;
            if(!confirm("¿Seguro que quieres borrar esta categoría?\n\n(Los productos NO se borrarán de tu inventario).")) return;
            try {
                await deleteDoc(doc(db, "categorias", window.editCatId));
                modalCat.hide();
            } catch(e) { alert("Error: " + e.message); }
        };

         function renderizarInventarioCategorias() {
            const tbody = document.getElementById('tabla-categorias-body');
            if(!tbody) return;
            tbody.innerHTML = '';
            window.categorias.forEach(c => {
                tbody.innerHTML += `<tr data-id="${c.id}">
                    <td class="handle-cat" style="width:40px"><i class="fa-solid fa-grip-vertical text-muted"></i></td>
                    <td><div style="width:20px;height:20px;background:${c.color};border-radius:4px"></div></td>
                    <td class="fw-bold">${c.nombre}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-light border" onclick="editarCat('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                    </td>
                </tr>`;
            });
            // Hacer la tabla de categorías ordenable
            new Sortable(tbody, { handle: '.handle-cat', animation: 150, onEnd: async () => {
                const rows = document.querySelectorAll('#tabla-categorias-body tr');
                const batch = writeBatch(db);
                rows.forEach((row, idx) => batch.update(doc(db, "categorias", row.dataset.id), { orden: idx }));
                await batch.commit();
            }});
        }

        window.renderizarProductosEnCategoria = (catNombre) => {
            const contenedor = document.getElementById('lista-prods-cat');
            if(!contenedor) return;

            // Filtramos qué productos tienen esta categoría en su array
            const prods = window.productos.filter(p => {
                const pCats = p.categorias || (p.categoria ? [p.categoria.toUpperCase()] : []);
                return pCats.map(c => c.toUpperCase()).includes(catNombre.toUpperCase());
            });

            if(prods.length === 0) {
                contenedor.innerHTML = '<div class="list-group-item small text-muted text-center py-2">Vacío</div>';
                return;
            }

            contenedor.innerHTML = prods.map(p => `
                <div class="list-group-item d-flex justify-content-between align-items-center py-1">
                    <span class="small text-truncate" style="max-width: 80%;">${p.nombre}</span>
                    <button class="btn btn-sm btn-outline-danger py-0 px-2 border-0" onclick="quitarProductoDeCategoria('${p.id}', '${catNombre}')" title="Quitar">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `).join('');
        };

        window.quitarProductoDeCategoria = async (prodId, catNombre) => {
            if(!confirm("¿Quitar este producto de la categoría?")) return;
            
            try {
                const p = window.productos.find(x => x.id === prodId);
                const catsViejas = p.categorias || (p.categoria ? [p.categoria] : []);
                
                // Filtramos para quitar SOLO esta categoría de su lista
                const nuevasCats = catsViejas.filter(c => c.toUpperCase() !== catNombre.toUpperCase());
                
                await updateDoc(doc(db, "productos", prodId), { categorias: nuevasCats });
                
                // Recargamos la listita visualmente después de medio segundo
                setTimeout(() => renderizarProductosEnCategoria(catNombre), 500);
            } catch(e) {
                alert("Error: " + e.message);
            }
        };

        function actualizarSelectCategorias() {
            const container = document.getElementById('prod-categorias-container');
            if(!container) return;
            
            container.innerHTML = window.categorias.map(c => `
                <div class="form-check">
                    <input class="form-check-input cat-checkbox" type="checkbox" value="${c.nombre}" id="chk-${c.id}">
                    <label class="form-check-label small" for="chk-${c.id}">${c.nombre}</label>
                </div>
            `).join('');
        }

        // --- ACTUALIZACIÓN DE RENDER POS (Para usar la lista maestra) ---
        window.renderizarPOS = () => { 
            const grid = document.getElementById('grid-productos-pos'); 
            if(!grid) return; 
            grid.innerHTML = ''; 
            
            window.categorias.forEach(cat => { 
                let count = 0;
                window.carrito.forEach(item => {
                    // Soporta items viejos y nuevos
                    const itemCats = item.categorias || (item.categoria ? [item.categoria] : []);
                    if(itemCats.map(c => c.toUpperCase()).includes(cat.nombre)) count += item.cantidad;
                });
                
                const badgeHTML = count > 0 ? `<div class="qty-badge" style="background-color: #8b5cf6; border-color: #fff;">${count}</div>` : ''; 
                grid.innerHTML += `<button class="btn-producto" style="background-color:${cat.color}; color:#ffffff; text-shadow: 1px 1px 3px rgba(0,0,0,0.6); border:none;" onclick="abrirBurbuja('${cat.nombre}')">${badgeHTML}<span class="fs-6 text-uppercase fw-bold">${cat.nombre}</span></button>`; 
            }); 
            
            if(window.categoriaActual) window.abrirBurbuja(window.categoriaActual);
        };

        // --- REGISTRO DEL SERVICE WORKER (MODO OFFLINE) ---
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('Modo Offline activado con éxito.', registration.scope);
                })
                .catch(error => {
                    console.log('Falló la activación del Modo Offline:', error);
                });
            });
        }
        // --- DETECTOR DE CONEXIÓN ONLINE/OFFLINE ---
        function actualizarEstadoRed() {
            const indicador = document.getElementById('status-indicador');
            if(!indicador) return;
            
            if (navigator.onLine) {
                indicador.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 0.4rem; vertical-align: middle; margin-bottom: 2px;"></i> Online';
                indicador.className = 'text-success fw-bold me-3';
            } else {
                indicador.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 0.4rem; vertical-align: middle; margin-bottom: 2px;"></i> Offline';
                indicador.className = 'text-warning fw-bold me-3'; // Usamos warning (amarillo) o danger (rojo)
            }
        }
        
        // Escuchamos si el internet se va o regresa
        window.addEventListener('online', actualizarEstadoRed);
        window.addEventListener('offline', actualizarEstadoRed);
        
        // Revisamos el estado la primera vez que carga la página
        actualizarEstadoRed();