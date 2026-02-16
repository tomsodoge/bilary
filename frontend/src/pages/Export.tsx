import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExportDialog from '../components/ExportDialog';

const Export: React.FC = () => {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="page-container">
      <div className="export-page">
        <header className="page-header">
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Back to Dashboard
          </button>
          <h1>Export Invoices</h1>
        </header>

        <div className="export-content">
          <div className="export-info">
            <h2>Download Your Invoices</h2>
            <p>
              Export your invoices as a ZIP file organized by month and company.
              You can choose to export a full year or a specific month, and filter
              between business and private invoices.
            </p>

            <div className="export-structure">
              <h3>ZIP Structure:</h3>
              <pre>
{`invoices-2024-01.zip
├── 01-January/
│   ├── Amazon/
│   │   ├── invoice-123.pdf
│   │   └── invoice-456.pdf
│   ├── Adobe/
│   │   └── invoice-789.pdf
│   └── ...
└── ...`}
              </pre>
            </div>
          </div>

          <button
            onClick={() => setShowDialog(true)}
            className="btn btn-primary btn-lg"
          >
            Start Export
          </button>
        </div>

        {showDialog && <ExportDialog onClose={() => setShowDialog(false)} />}
      </div>
    </div>
  );
};

export default Export;
