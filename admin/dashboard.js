(async function() {
    const statusEl = document.getElementById('status');
    const tbody = document.querySelector('#level-summary-table tbody');

    statusEl.textContent = "Loading configuration...";

    try {
        // Fetch the config from the backend API
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error("Failed to load config");
        
        const config = await res.json();
        
        if (!config.supabaseUrl) {
            throw new Error("Missing supabaseUrl in config");
        }

        statusEl.textContent = "Connecting to Supabase Realtime...";
        const supabase = window.supabase.createClient(
            config.supabaseUrl,
            config.supabaseAnonKey
        );

        // 1. Fetch initial data
        async function loadInitialData() {
            const { data, error } = await supabase
                .from('level_summary')
                .select('*')
                .order('student_id', { ascending: true })
                .order('level_index', { ascending: true });

            if (error) {
                statusEl.textContent = `Error fetching data: ${error.message}`;
                return;
            }

            tbody.innerHTML = '';
            data.forEach(row => appendRow(row));
            statusEl.textContent = "Connected. Waiting for realtime updates...";
        }

        // 2. Subscribe to Realtime changes
        function setupRealtime() {
            supabase
                .channel('admin-dashboard')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'level_summary' }, payload => {
                    console.log('Realtime update:', payload);
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const existingRow = document.getElementById(`row-${payload.new.level_id}`);
                        if (existingRow) existingRow.remove();
                        
                        appendRow(payload.new);
                    }
                })
                .subscribe((status) => {
                    console.log('Realtime status:', status);
                });
        }

        // 3. Helper to append table rows
        function appendRow(row) {
            const tr = document.createElement('tr');
            tr.id = `row-${row.level_id}`;
            
            tr.innerHTML = `
                <td>${row.student_id}</td>
                <td>${row.week}</td>
                <td>${row.level_index}</td>
                <td>${row.first_attempt_score?.toFixed(2) || 'N/A'}</td>
                <td>${row.total_attempts}</td>
                <td>${row.repeats_this_level}</td>
                <td>${row.next_difficulty_assigned || '-'}</td>
            `;
            tbody.appendChild(tr);
        }

        await loadInitialData();
        setupRealtime();

    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.style.color = '#f87171';
        console.error(err);
    }
})();