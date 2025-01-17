function roundGrade(grade) {
    return Math.round(grade * 2) / 2;
}

function getSubjectNameFromTable(table) {
    let currentRow = table.closest('tr');
    if (currentRow) {
        let subjectRow = currentRow.previousElementSibling;
        if (subjectRow) {
            let firstCell = subjectRow.querySelector('td');
            if (firstCell) {
                let br = firstCell.querySelector('br');
                if (br && br.nextSibling) {
                    return br.nextSibling.textContent.trim();
                }
            }
        }
    }
    return 'Unknown Subject';
}

function createStatsButton() {
    const table = document.querySelector('.mdl-data-table');
    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        margin-bottom: 10px;
        text-align: right;
    `;
    
    const button = document.createElement('button');
    button.innerHTML = '📊 Stats';
    button.style.cssText = `
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s;
    `;
    button.addEventListener('mouseover', () => button.style.backgroundColor = '#45a049');
    button.addEventListener('mouseout', () => button.style.backgroundColor = '#4CAF50');
    
    const statsPanel = document.createElement('div');
    statsPanel.style.cssText = `
        position: absolute;
        right: 0;
        top: calc(100% + 20px);
        width: 300px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 15px;
        display: none;
        z-index: 999;
        max-height: 80vh;
        overflow-y: auto;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    button.onclick = () => {
        if (statsPanel.style.display === 'none') {
            statsPanel.style.display = 'block';
            // Force reflow
            statsPanel.offsetHeight;
            statsPanel.style.opacity = '1';
            statsPanel.style.transform = 'translateY(0)';
            updateStats();
        } else {
            statsPanel.style.opacity = '0';
            statsPanel.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                statsPanel.style.display = 'none';
            }, 300);
        }
    };

    container.appendChild(button);
    container.appendChild(statsPanel);
    table.parentNode.insertBefore(container, table);
    return statsPanel;
}


function getGradeStats() {
    const grades = [];
    const allGrades = [];
    const gradesNeedingAttention = [];
    
    const gradeTables = document.querySelectorAll('.clean');
    gradeTables.forEach(table => {
        const subjectName = getSubjectNameFromTable(table);
        let subjectGrades = [];
        let examNames = [];
        let weights = [];
        
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.getElementsByTagName('td');
            if (cells.length >= 4) {  // Check for 4 cells to include weight
                const examCell = cells[1]?.textContent.trim();
                const gradeText = cells[2]?.textContent.trim();
                const weightText = cells[3]?.textContent.trim();
                const weight = weightText ? parseFloat(weightText) : 1; // Default to 1 if no weight
                
                if (gradeText && !isNaN(parseFloat(gradeText)) && gradeText !== '--') {
                    const grade = parseFloat(gradeText);
                    subjectGrades.push(grade);
                    examNames.push(examCell);
                    weights.push(weight);
                    
                    allGrades.push({
                        subject: subjectName,
                        grade: grade,
                        examName: examCell,
                        weight: weight
                    });
                }
            }
        });
        
        if (subjectGrades.length > 0) {
            // Calculate weighted average
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            const currentAvg = subjectGrades.reduce((sum, grade, i) => sum + grade * weights[i], 0) / totalWeight;
            const decimal = currentAvg % 1;
            
            let nextThreshold;
            if (decimal < 0.25) {
                nextThreshold = Math.floor(currentAvg) + 0.25;
            } else if (decimal < 0.75) {
                nextThreshold = Math.floor(currentAvg) + 0.75;
            } else {
                nextThreshold = Math.ceil(currentAvg) + 0.25;
            }
            
            const distanceToThreshold = Math.abs(currentAvg - nextThreshold);
            if (distanceToThreshold <= 0.05) {
                // Calculate required grade considering weights
                const targetAverage = nextThreshold;
                const weightedSum = subjectGrades.reduce((sum, grade, i) => sum + grade * weights[i], 0);
                // Assume next exam has weight 1 by default
                const requiredGrade = ((targetAverage * (totalWeight + 1)) - weightedSum);
                
                if (requiredGrade <= 6.0) {
                    gradesNeedingAttention.push({
                        subject: subjectName,
                        currentAverage: currentAvg,
                        nextThreshold: nextThreshold,
                        requiredGrade: requiredGrade,
                        currentWeight: totalWeight,
                        numExams: subjectGrades.length,
                        grades: subjectGrades.map((grade, index) => 
                            `${examNames[index]} (${weights[index]}): ${grade}`
                        ).join(', ')
                    });
                }
            }
            
            grades.push({
                subject: subjectName,
                grade: currentAvg
            });
        }
    });



    if (grades.length === 0) {
        return {
            median: '0.000',
            best: { subject: 'No grades found', grade: 0 },
            worstGrades: [],
            improvementPotential: []
        };
    }

    const sortedGrades = grades.map(g => g.grade).sort((a, b) => a - b);
    const medianGrade = sortedGrades.length % 2 === 0 
        ? (sortedGrades[sortedGrades.length/2 - 1] + sortedGrades[sortedGrades.length/2]) / 2
        : sortedGrades[Math.floor(sortedGrades.length/2)];

    const lowestGrade = Math.min(...allGrades.map(g => g.grade));
    const worstGrades = allGrades.filter(g => g.grade === lowestGrade);
    
    window.allGrades = allGrades;
    
    return {
        median: medianGrade.toFixed(3),
        best: grades.reduce((best, curr) => curr.grade > best.grade ? curr : best),
        worstGrades: worstGrades,
        improvementPotential: gradesNeedingAttention
    };
}

function updateStats() {
    const statsPanel = document.querySelector('#stats-panel');
    const stats = getGradeStats();
    
    const bestGradeExam = allGrades.find(g => 
        g.subject === stats.best.subject && 
        Math.abs(g.grade - stats.best.grade) < 0.01
    );
    
    statsPanel.innerHTML = `
        <div style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; text-align: left;">
            <h3 style="margin: 0 0 10px 0;">📊 Grade Statistics</h3>
            <button onclick="this.parentElement.parentElement.style.display='none'" 
                    style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer;">
                ✖
            </button>
        </div>
        
        <div style="margin-bottom: 15px; text-align: left;">
            <p><strong>Median Grade:</strong> ${Number(stats.median).toFixed(2)}</p>
            
            <div style="margin: 10px 0;">
                <strong>Best Grade (${stats.best.grade.toFixed(2)}):</strong>
                <div style="margin: 5px 0 5px 10px; padding: 5px; background-color: #e8f5e9; border-radius: 3px; border-left: 3px solid #4CAF50;">
                    ${stats.best.subject}${bestGradeExam ? ` - ${bestGradeExam.examName} (${bestGradeExam.weight})` : ''}
                </div>
            </div>
            
            <div style="margin: 10px 0;">
                <strong>Lowest Grades (${stats.worstGrades[0]?.grade.toFixed(2)}):</strong>
                ${stats.worstGrades.map(grade => `
                    <div style="margin: 5px 0 5px 10px; padding: 5px; background-color: #ffebee; border-radius: 3px; border-left: 3px solid #ef5350;">
                        ${grade.subject} - ${grade.examName} (${grade.weight})
                    </div>
                `).join('')}
            </div>
        </div>

        ${stats.improvementPotential.length > 0 ? `
            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px; text-align: left;">
                <h4 style="margin: 0 0 10px 0;">💡 Improvement Opportunities</h4>
                ${stats.improvementPotential.map(grade => `
                    <div style="margin: 8px 0; padding: 5px; background-color: white; border-radius: 3px;">
                        <p style="margin: 5px 0;">
                            <strong>${grade.subject}</strong><br>
                            Current average: ${grade.currentAverage.toFixed(2)} → Target: ${grade.nextThreshold.toFixed(2)}
                            <small style="color: #666; display: block;">
                                Previous grades: ${grade.grades}<br>
                                Need <strong>${Math.min(6, grade.requiredGrade).toFixed(2)}</strong> on next exam (weight 1) to reach ${grade.nextThreshold.toFixed(2)}
                            </small>
                        </p>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}




// Initialize
const statsPanel = createStatsButton();
statsPanel.id = 'stats-panel';
calculateAverage();

// Set up the observer
const observer = new MutationObserver(() => {
    calculateAverage();
    if (statsPanel.style.display === 'block') {
        updateStats();
    }
});

const table = document.querySelector('.mdl-data-table');
if (table) {
    observer.observe(table, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

function calculateAverage() {
    const table = document.querySelector('.mdl-data-table');
    const grades = [];
    
    const gradeTables = document.querySelectorAll('.clean');
    gradeTables.forEach(gradeTable => {
        const subjectName = getSubjectNameFromTable(gradeTable);
        let subjectGrades = [];
        
        const rows = gradeTable.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.getElementsByTagName('td');
            if (cells.length >= 3) {
                const gradeText = cells[2]?.textContent.trim();
                if (gradeText && !isNaN(parseFloat(gradeText)) && gradeText !== '--') {
                    subjectGrades.push(parseFloat(gradeText));
                }
            }
        });
        
        if (subjectGrades.length > 0) {
            const subjectAvg = subjectGrades.reduce((a, b) => a + b, 0) / subjectGrades.length;
            grades.push(subjectAvg);
        }
    });

    if (grades.length === 0) return;

    const sumGrades = grades.reduce((a, b) => a + b, 0);
    const originalAverage = (sumGrades / grades.length).toFixed(3);
    const roundedAverage = roundGrade(sumGrades / grades.length).toFixed(1);

    const existingAverage = document.getElementById('average-row');
    if (existingAverage) {
        existingAverage.remove();
    }

    const tooltipStyles = `
        position: relative;
        display: inline-block;
        margin-left: 5px;
        cursor: help;
    `;

    const tooltipText = `
        position: absolute;
        visibility: hidden;
        width: 300px;
        background-color: #555;
        color: #fff;
        text-align: center;
        padding: 10px;
        border-radius: 6px;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 1000;
        font-weight: normal;
        font-size: 0.9em;
    `;

    const tooltipArrow = `
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: #555 transparent transparent transparent;
    `;

    const newRow = table.insertRow(-1);
    newRow.id = 'average-row';
    newRow.innerHTML = `
        <td style="border-top: 2px solid #ccc; padding: 10px; font-weight: bold; background-color: #f5f5f5;">
            <b>Average:</b>
        </td>
        <td style="border-top: 2px solid #ccc; padding: 10px; text-align: left; font-weight: bold; color: ${roundedAverage >= 4 ? '#2e7d32' : '#c62828'}; background-color: #f5f5f5;">
            ${roundedAverage} (${originalAverage})
            <span style="${tooltipStyles}">
                ℹ️
                <span style="${tooltipText}">
                    The first number (${roundedAverage}) is the rounded average of all subjects and rounded to 1 decimal. This is comparable with your final grade average accross all subjects at  the end of the semester.
                    <br><br>
                    The second number (${originalAverage}) is the unrounded raw average.
                    <span style="${tooltipArrow}"></span>
                </span>
            </span>
        </td>
        <td style="border-top: 2px solid #ccc; background-color: #f5f5f5;"></td>
        <td style="border-top: 2px solid #ccc; background-color: #f5f5f5;"></td>
        <td style="border-top: 2px solid #ccc; background-color: #f5f5f5;"></td>
    `;

    // hover events for the tooltip
    const tooltipContainer = newRow.querySelector('span[style*="cursor: help"]');
    const tooltip = tooltipContainer.querySelector('span[style*="visibility: hidden"]');

    tooltipContainer.addEventListener('mouseenter', () => {
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    });

    tooltipContainer.addEventListener('mouseleave', () => {
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
    });
}