<script>
  // Fetch the entire history (array of data points) from the backend
  const fetchForexHistory = async () => {
    try {
      const response = await fetch("/forex/history");
      if (!response.ok) {
        throw new Error("Failed to fetch forex history");
      }
      // This returns an array of objects like:
      // [ { O:1.03, H:1.04, L:1.02, C:1.0394, timestamp: "..." }, ... ]
      const historyData = await response.json();
      return historyData;
    } catch (error) {
      console.error("Error fetching forex history:", error.message);
      return [];
    }
  };

  // Update the chart using the entire history array
  const updateChartFromHistory = (chart, historyArray) => {
    // Clear the existing data
    chart.data.labels = [];
    chart.data.datasets[0].data = [];

    // Populate from the history
    historyArray.forEach((entry) => {
      // Convert the timestamp to a readable time label
      const timeLabel = new Date(entry.timestamp).toLocaleTimeString();
      chart.data.labels.push(timeLabel);

      // We'll plot the Close (C) value on the y-axis
      chart.data.datasets[0].data.push(entry.C);
    });

    chart.update(); // Re-render the chart with new data
  };

  // Create the chart (unchanged)
  const createChart = (ctx) => {
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "EUR/USD Close",
            data: [],
            borderColor: "rgba(75, 192, 192, 1)",
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Time" } },
          y: { title: { display: true, text: "Price" } },
        },
      },
    });
  };

  // Main function to initialize and periodically update the chart
  const initForexChart = () => {
    const ctx = document.getElementById("forex-chart").getContext("2d");
    const chart = createChart(ctx);

    // Initial load
    (async () => {
      const history = await fetchForexHistory();
      updateChartFromHistory(chart, history);
    })();

    // Update every 5 seconds
    setInterval(async () => {
      const history = await fetchForexHistory();
      updateChartFromHistory(chart, history);
    }, 5000);
  };

  // Start after DOM loads
  document.addEventListener("DOMContentLoaded", initForexChart);
</script>
