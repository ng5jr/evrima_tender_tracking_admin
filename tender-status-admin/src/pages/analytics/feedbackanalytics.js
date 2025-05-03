import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, handleSignOut } from "../../firebase/firebaseconfig";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./FeedbackAnalytics.css"; // Make sure this CSS handles potential size changes

import Logo from "../../components/logo";
import { Link } from "react-router-dom";

// Registration (needed for both Bar chart types)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// --- Helper Function to Generate Stacked Config (Services on X, Stars Stacked) ---
const generateStackedChartConfig = (feedbackDocs) => {
  const countsByStarService = {
    1: [0, 0],
    2: [0, 0],
    3: [0, 0],
    4: [0, 0],
    5: [0, 0],
  }; // [website, tender]

  feedbackDocs.forEach((doc) => {
    const feedback = doc.data();
    if (feedback.websiteRating >= 1 && feedback.websiteRating <= 5) {
      countsByStarService[feedback.websiteRating][0]++;
    }
    if (feedback.tenderRating >= 1 && feedback.tenderRating <= 5) {
      countsByStarService[feedback.tenderRating][1]++;
    }
  });

  const serviceLabels = ["Website", "Tender Service"];
  const starColors = {
    /* ... (same colors as previous response) ... */
    "1 ⭐": "rgba(255, 99, 132, 0.6)",
    "2 ⭐": "rgba(255, 159, 64, 0.6)",
    "3 ⭐": "rgba(255, 205, 86, 0.6)",
    "4 ⭐": "rgba(75, 192, 192, 0.6)",
    "5 ⭐": "rgba(54, 162, 235, 0.6)",
  };
  const starBorderColors = {
    /* ... (same border colors) ... */ "1 ⭐": "rgba(255, 99, 132, 1)",
    "2 ⭐": "rgba(255, 159, 64, 1)",
    "3 ⭐": "rgba(255, 205, 86, 1)",
    "4 ⭐": "rgba(75, 192, 192, 1)",
    "5 ⭐": "rgba(54, 162, 235, 1)",
  };

  const datasets = Object.keys(countsByStarService).map((star) => {
    const starLabel = `${star} ⭐`;
    return {
      label: starLabel,
      data: countsByStarService[star],
      backgroundColor: starColors[starLabel] || "rgba(201, 203, 207, 0.6)",
      borderColor: starBorderColors[starLabel] || "rgba(201, 203, 207, 1)",
      borderWidth: 1,
    };
  });

  const data = { labels: serviceLabels, datasets: datasets };
  const options = {
    scales: {
      x: { stacked: true, title: { display: true, text: "Service" } },
      y: {
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: "Number of Ratings" },
      },
    },
    plugins: {
      title: {
        display: true,
        text: "Distribution of Star Ratings per Service (Stacked)",
        font: { size: 18 },
      },
      legend: { position: "top" },
    },
    responsive: true,
    maintainAspectRatio: false, // Allow chart to resize better
  };
  return { data, options };
};

// --- Helper Function to Generate Grouped Config (Stars on X, Services Grouped) ---
const generateGroupedChartConfig = (feedbackDocs) => {
  const websiteCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const tenderCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  feedbackDocs.forEach((doc) => {
    const feedback = doc.data();
    if (feedback.websiteRating >= 1 && feedback.websiteRating <= 5) {
      websiteCounts[feedback.websiteRating]++;
    }
    if (feedback.tenderRating >= 1 && feedback.tenderRating <= 5) {
      tenderCounts[feedback.tenderRating]++;
    }
  });

  const starLabels = ["1 ⭐", "2 ⭐", "3 ⭐", "4 ⭐", "5 ⭐"];
  const datasets = [
    {
      label: "Website",
      data: Object.values(websiteCounts),
      backgroundColor: "rgba(54, 162, 235, 0.6)",
      borderColor: "rgba(54, 162, 235, 1)",
      borderWidth: 1,
    },
    {
      label: "Tender",
      data: Object.values(tenderCounts),
      backgroundColor: "rgba(99, 255, 109, 0.56)",
      borderColor: "rgb(99, 255, 109)",
      borderWidth: 1,
    },
  ];

  const data = { labels: starLabels, datasets: datasets };
  const options = {
    // Note: stacked: false is the default, no need to set it
    scales: {
      x: { title: { display: true, text: "Rating" } },
      y: {
        beginAtZero: true,
        title: { display: true, text: "Number of Ratings" },
      },
    },
    plugins: {
      title: {
        display: true,
        text: "Website & Tender Service Feedback (Grouped)",
        font: { size: 18 },
      },
      legend: { position: "top" },
    },
    responsive: true,
    maintainAspectRatio: false, // Allow chart to resize better
  };
  return { data, options };
};

const generateAverageChartConfig = (feedbackDocs, averageRatings) => {
  // Note: Takes pre-calculated averages as input for efficiency
  const labels = ["Website", "Tender"];
  const data = {
    labels: labels,
    datasets: [
      {
        // label: 'Average Rating', // Optional
        // Use the passed averages
        data: [averageRatings.website, averageRatings.tender],
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)", // Website color
          "rgba(99, 255, 109, 0.7)", // Tender color (matches grouped)
        ],
        borderColor: ["rgba(54, 162, 235, 1)", "rgb(99, 255, 109)"],
        borderWidth: 1,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
    ],
  };

  const options = {
    scales: {
      x: { title: { display: true, text: "Service" } },
      y: {
        title: { display: true, text: "Average Star Rating" },
        beginAtZero: false,
        min: 1,
        max: 5,
        ticks: { stepSize: 1 },
      },
    },
    plugins: {
      title: {
        display: true,
        text: "Average Service Ratings",
        font: { size: 18 },
      },
      legend: { display: false }, // Legend off for averages chart
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(1) + " ⭐";
            }
            return label;
          },
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return { data, options };
};

function FeedbackAnalytics() {
  // State for fetched data configurations
  const [chartConfigs, setChartConfigs] = useState({
    stacked: null,
    grouped: null,
    average: null,
  });
  // State to track the selected view
  const [chartView, setChartView] = useState("stacked"); // Default view
  // Other states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [totalFeedbackCount, setTotalFeedbackCount] = useState(0);
  const [averageRatings, setAverageRatings] = useState({
    website: 0,
    tender: 0,
  });
  // Add this state to hold comment data for display
  const [allCommentsDisplayData, setAllCommentsDisplayData] = useState([]);
  // Add these states for date filtering
  const [selectedDate, setSelectedDate] = useState(""); // Store selected 'YYYY-MM-DD'
  const [filteredComments, setFilteredComments] = useState([]); // Comments for selected date
  const [availableCommentDates, setAvailableCommentDates] = useState([]); // Dates for the dropdown
  // Note: Keep your existing `allCommentsDisplayData` state - we'll filter based on it.

  // Fetch data and generate BOTH chart configurations
  useEffect(() => {
    async function fetchDataAndConfigs() {
      setLoading(true); // Start loading when fetching data
      setError(null); // Clear previous errors
      try {
        const feedbackCollectionRef = collection(db, "guestFeedback");
        const querySnapshot = await getDocs(feedbackCollectionRef);
        const feedbackDocs = querySnapshot.docs; // Get the docs array

        setTotalFeedbackCount(querySnapshot.size); // Set total count

        if (querySnapshot.empty) {
          console.log("No feedback data found.");
          setChartConfigs({ stacked: null, grouped: null, average: null }); // Set null configs if no data
        } else {
          // --- Calculate Averages (Needed for Avg Chart & Text Display) ---
          let websiteTotalStars = 0,
            websiteRatingCount = 0;
          let tenderTotalStars = 0,
            tenderRatingCount = 0;
          feedbackDocs.forEach((doc) => {
            const feedback = doc.data();
            if (
              typeof feedback.websiteRating === "number" &&
              feedback.websiteRating >= 1 &&
              feedback.websiteRating <= 5
            ) {
              websiteTotalStars += feedback.websiteRating;
              websiteRatingCount++;
            }
            if (
              typeof feedback.tenderRating === "number" &&
              feedback.tenderRating >= 1 &&
              feedback.tenderRating <= 5
            ) {
              tenderTotalStars += feedback.tenderRating;
              tenderRatingCount++;
            }
          });
          const websiteAverage =
            websiteRatingCount > 0 ? websiteTotalStars / websiteRatingCount : 0;
          const tenderAverage =
            tenderRatingCount > 0 ? tenderTotalStars / tenderRatingCount : 0;
          const calculatedAverages = {
            website: websiteAverage,
            tender: tenderAverage,
          };
          setAverageRatings(calculatedAverages); // Set state for text display
          // --- End Average Calculation ---

          // Generate all configurations
          const stackedConfig = generateStackedChartConfig(feedbackDocs);
          const groupedConfig = generateGroupedChartConfig(feedbackDocs);
          // 4. Generate Average config using calculated averages
          const averageConfig = generateAverageChartConfig(
            feedbackDocs,
            calculatedAverages
          );

          const dataToProcess = feedbackDocs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })); // Or use 'rawData' if already available

          console.log("Extracting comments for display..."); // Optional log
          const commentsForDisplay = dataToProcess
            .filter(
              (item) => item.comments && String(item.comments).trim() !== ""
            ) // Keep only items with non-empty comments
            .map((item) => ({
              // Extract only needed fields
              id: item.id,
              comment: item.comments,
              createdAt: item.timestamp, // Keep original timestamp object
            }))
            .sort((a, b) => {
              // Optional: Sort newest first
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : 0;
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : 0;
              return dateB - dateA; // Descending order
            });

          setAllCommentsDisplayData(commentsForDisplay);
          const datesWithComments = new Set();
          // Use the 'commentsForDisplay' array you just created
          commentsForDisplay.forEach((item) => {
            // Check for valid timestamp (comment check already done by filter before)
            if (item.createdAt && item.createdAt.toDate) {
              try {
                const jsDate = item.createdAt.toDate();
                const year = jsDate.getUTCFullYear();
                const month = String(jsDate.getUTCMonth() + 1).padStart(2, "0");
                const day = String(jsDate.getUTCDate()).padStart(2, "0");
                datesWithComments.add(`${year}-${month}-${day}`);
              } catch (e) {
                console.warn(
                  "Error processing date for dropdown extraction:",
                  item.id,
                  e
                );
              }
            }
          });
          const sortedDates = Array.from(datesWithComments).sort((a, b) =>
            b.localeCompare(a)
          ); // Newest first
          setAvailableCommentDates(sortedDates); // Set state for dropdown
          // Store all configurations in state

          setChartConfigs({
            stacked: stackedConfig,
            grouped: groupedConfig,
            average: averageConfig, // Store average config
          });
        }
      } catch (err) {
        console.error("Error fetching/processing feedback data:", err);
        setError("Failed to load feedback data.");
        setChartConfigs({ stacked: null, grouped: null }); // Clear configs on error
      } finally {
        setLoading(false); // Data fetching/processing complete
      }
    }

    fetchDataAndConfigs();
  }, []);

  useEffect(() => {
    // Filter based on the main comment list state 'allCommentsDisplayData'
    if (!selectedDate || allCommentsDisplayData.length === 0) {
      setFilteredComments([]); // Clear/reset filtered list if no date selected
      return; // Exit early
    }
    try {
      // This part filters the existing allCommentsDisplayData state
      console.log(`Filtering comments for date: ${selectedDate}`);
      const dateParts = selectedDate.split("-").map(Number);
      const startOfDay = new Date(
        Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0)
      );
      const endOfDay = new Date(
        Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59, 999)
      );

      const commentsForDate = allCommentsDisplayData.filter((item) => {
        if (item.createdAt && item.createdAt.toDate) {
          const itemDate = item.createdAt.toDate();
          return itemDate >= startOfDay && itemDate <= endOfDay;
        }
        return false;
      });

      console.log(
        `Found ${commentsForDate.length} comments for ${selectedDate}`
      );
      setFilteredComments(commentsForDate); // Update the state holding filtered comments
    } catch (dateError) {
      console.error("Error processing date or filtering comments:", dateError);
      setFilteredComments([]); // Clear on error
    }
    // Depend on the selected date and the source comment data list
  }, [selectedDate, allCommentsDisplayData]);

  // Determine the current config based on the selected view
  const currentConfig = chartConfigs[chartView];

  return (
    <div className="feedback-analytics">
      <Logo />
      <button onClick={handleSignOut} className="Btn btn-signout">
        <div className="sign">
          {/* SVG Icon */}
          <svg viewBox="0 0 512 512">
            <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path>
          </svg>
        </div>
      </button>
      <Link
        to="/operator"
        className="Btn analytics-button"
        aria-label="View Analytics"
      >
        <div className="sign">
          {/* SVG Icon */}
          <svg version="1.1" id="Icons" viewBox="0 0 32 32">
            <g>
              <path d="M25,18H9c-0.6,0-1-0.4-1-1s0.4-1,1-1h13l-1.6-1.2c-0.4-0.3-0.5-1-0.2-1.4c0.3-0.4,1-0.5,1.4-0.2l4,3   c0.3,0.3,0.5,0.7,0.3,1.1S25.4,18,25,18z" />
            </g>
            <path d="M17,27v-1H9.5c0,0.1,0,0.2-0.1,0.2C9.1,27.3,8.1,28,7,28c-0.6,0-1,0.4-1,1s0.4,1,1,1h11C17.4,29.2,17,28.1,17,27z" />
            <path d="M17,22H9.9H3c-0.6,0-1-0.4-1-1V6c0-0.6,0.4-1,1-1h22c0.6,0,1,0.4,1,1v1h2V6c0-1.7-1.3-3-3-3H3C1.3,3,0,4.3,0,6v15  c0,1.7,1.3,3,3,3h6.9H17V22z" />
            <path d="M29,9h-7c-1.7,0-3,1.3-3,3h2c0-0.6,0.4-1,1-1h7c0.6,0,1,0.4,1,1v10h-9v-2h-2v7c0,1.7,1.3,3,3,3h7c1.7,0,3-1.3,3-3V12  C32,10.3,30.7,9,29,9z M27,27h-3c-0.6,0-1-0.4-1-1s0.4-1,1-1h3c0.6,0,1,0.4,1,1S27.6,27,27,27z" />
          </svg>
        </div>
      </Link>

      {/* Use currentTitle which updates dynamically */}
      <h2>Feedback Analytics Dashboard</h2>

      {/* --- Toggle Buttons --- */}
      <div className="chart-toggle-buttons">
        <button
          onClick={() => setChartView("stacked")}
          disabled={chartView === "stacked"}
        >
          {" "}
          View by Service (Stacked){" "}
        </button>
        <button
          onClick={() => setChartView("grouped")}
          disabled={chartView === "grouped"}
        >
          {" "}
          View by Rating (Grouped){" "}
        </button>
        {/* 5. Add Average Chart Button */}
        <button
          onClick={() => setChartView("average")}
          disabled={chartView === "average"}
        >
          {" "}
          View Averages{" "}
        </button>
      </div>
      {/* --- End Toggle Buttons --- */}
      {totalFeedbackCount > 0 && (
        <p>(Total Feedback Records: {totalFeedbackCount})</p>
      )}
      <div className="chart-container">
        {loading ? (
          <div className="loading-data">Loading chart data...</div>
        ) : error ? (
          <div style={{ color: "red" }}>{error}</div>
        ) : currentConfig && currentConfig.data.datasets.length > 0 ? (
          // Render the Bar chart with the currently selected configuration
          <Bar data={currentConfig.data} options={currentConfig.options} />
        ) : !loading ? ( // Ensure we only show this message after loading attempt
          <div>No feedback data available to display.</div>
        ) : null}
      </div>

      <div className="all-comments-section">
        <div className="all-comments-header">
          <h3>Guest Comments</h3>

          {/* --- Date Selector Dropdown --- */}
          <div className="date-selector">
            <select
              id="comment-date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={loading || availableCommentDates.length === 0}
            >
              <option value="">-- Select Date --</option>{" "}
              {/* Prompt to select */}
              {availableCommentDates.map((dateStr) => (
                <option key={dateStr} value={dateStr}>
                  {dateStr}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* --- End Date Selector --- */}

        <div className="comments-list">
          {
            loading ? (
              <p>Loading comments...</p>
            ) : error ? (
              <p>Could not load comments due to an error.</p>
            ) : // Display logic depends on whether a date is selected
            selectedDate && filteredComments.length > 0 ? ( // Date selected AND comments found for date
              <ul className="comments-list-ul">
                {filteredComments.map((commentData) => (
                  <li key={commentData.id}>
                    <p>{commentData.comment}</p>
                    {/* <small>
                      Received:
                      {commentData.createdAt?.toDate
                        ? commentData.createdAt.toDate().toLocaleString()
                        : "Unknown date"}
                    </small> */}
                  </li>
                ))}
              </ul>
            ) : selectedDate && filteredComments.length === 0 ? ( // Date selected but NO comments for date
              <p>No comments found for {selectedDate}.</p>
            ) : !selectedDate && allCommentsDisplayData.length > 0 ? ( // No date selected, comments exist overall
              <p>Select a date from the dropdown to view comments.</p>
            ) : !selectedDate &&
              allCommentsDisplayData.length === 0 &&
              !loading ? ( // No date selected, no comments overall (and not loading)
              <p>No comments found in the feedback data.</p>
            ) : null /* Default case */
          }
        </div>
      </div>
    </div>
  );
}

export default FeedbackAnalytics;
