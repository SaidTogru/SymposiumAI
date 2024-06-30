import React, { Component } from 'react';
import { Input, Button, LinearProgress, Box, List, ListItem } from '@material-ui/core';
import "./Home.css"

class Home extends Component {
	constructor(props) {
		super(props)
		this.state = {
			url: '',
			selectedFiles: [],
			uploadedFiles: [],
			uploading: false
		}
	}

	handleChange = (e) => this.setState({ url: e.target.value })

	join = () => {
		if (this.state.url !== "") {
			var url = this.state.url.split("/")
			window.location.href = `/${url[url.length-1]}`
		} else {
			var url = Math.random().toString(36).substring(2, 7)
			window.location.href = `/${url}`
		}
	}

	handleFileChange = (event) => {
		this.setState({ selectedFiles: Array.from(event.target.files) });
	}

	handleUpload = () => {
		this.setState({ uploading: true });

		// Simulate an upload process
		setTimeout(() => {
			this.setState(prevState => ({
				uploading: false,
				uploadedFiles: prevState.selectedFiles,
				selectedFiles: []
			}));
			alert('Files uploaded successfully');
		}, 2000);
	}

	render() {
		return (
			<div className="container2">
				<div style={{fontSize: "14px", background: "white", width: "10%", textAlign: "center", margin: "auto", marginBottom: "10px"}}>
				</div>
				
				<div>
					<h1 style={{ fontSize: "45px" }}>SymposiumAI</h1>
					{/* <p style={{ fontWeight: "200" }}></p> */}
				</div>

				<div style={{
					background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "400px",
					textAlign: "center", margin: "auto", marginTop: "100px"
				}}>
					<p style={{ margin: 0, fontWeight: "bold", paddingRight: "50px" }}>Create or join a meeting</p>
					<Input placeholder="URL" onChange={e => this.handleChange(e)} />
					<Button variant="contained" color="primary" onClick={this.join} style={{ margin: "20px" }}>Go</Button>
					<div style={{ marginTop: "20px" }}>
						<input
							accept="*"
							style={{ display: 'none' }}
							id="raised-button-file"
							type="file"
							onChange={this.handleFileChange}
							multiple
						/>
						<label htmlFor="raised-button-file">
							<Button variant="contained" color="primary" component="span">
								Add your Context Files to the Meeting
							</Button>
						</label>
						{this.state.selectedFiles.length > 0 && (
							<div style={{ marginTop: "10px" }}>
								<Button variant="contained" color="secondary" onClick={this.handleUpload}>
									Upload
								</Button>
							</div>
						)}
						{this.state.uploading && <LinearProgress variant="determinate" value={50} style={{ marginTop: "10px" }} />}
					</div>
					{this.state.uploadedFiles.length > 0 && (
						<Box mt={2} p={2} border={1} borderColor="grey.400" borderRadius={4}>
							<h3>Uploaded Files:</h3>
							<List>
								{this.state.uploadedFiles.map((file, index) => (
									<ListItem key={index}>{file.name}</ListItem>
								))}
							</List>
						</Box>
					)}
				</div>
			</div>
		)
	}
}

export default Home;
