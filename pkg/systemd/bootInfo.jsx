import React, { useEffect, useState } from "react";
import cockpit from "cockpit";
import {
    Card,
    CardBody,
    CardTitle, CodeBlock, CodeBlockCode,
    EmptyStateHeader,
    EmptyStateVariant,
    List,
    ListItem,
    ListVariant, Spinner
} from "@patternfly/react-core";
import "./bootInfo.scss";
import { EmptyState, EmptyStateBody } from "@patternfly/react-core/dist/esm/components/EmptyState";

const _ = cockpit.gettext;

export function BootInfo({ user }) {
    const [svg, setSvg] = useState(undefined);
    const [summary, setSummary] = useState(null);
    const userMode = user !== "system";

    useEffect(() => {
        let string = "";
        const cmd = userMode ? ["systemd-analyze", "--user", "plot"] : ["systemd-analyze", "plot"];
        cockpit.spawn(cmd)
                .stream((svg_part) => {
                    string += svg_part;
                })
                .then(() => {
                    const doc = new DOMParser().parseFromString(string, "text/xml");
                    doc.querySelector("rect.background")?.remove();
                    doc.querySelector("text[y='30']")?.remove();
                    const svgElem = doc.querySelector("svg");
                    svgElem.style.scale = "0.5";
                    const summaryElem = doc.querySelector("text[y='50']");
                    // Grabs summary from SVG and puts it in the card body instead
                    if (summaryElem !== null) {
                        setSummary(summaryElem.textContent);
                        summaryElem.remove();
                    }
                    const [plot, legend] = doc.querySelectorAll("g");
                    legend.remove();
                    [...plot.querySelectorAll("text.left"), ...plot.querySelectorAll("text.right")].forEach((text) => {
                        const match = text.innerHTML.match(/^(?<service>.+\.[a-z._-]+)(\s+\((?<time>\d+(\.\d+)?)\w+\))?$/);
                        if (match !== null) {
                            const service = match.groups.service;
                            const time = match.groups.time;
                            text.setAttribute("data-service", service);
                            text.setAttribute("data-time", time);
                            text.classList.add("clickable-service");
                        }
                    });
                    setSvg(doc.documentElement);
                })
                .catch((e) => {
                    setSvg(null);
                    setSummary(e);
                });
    }, [userMode]);

    if (svg === undefined) {
        return (
            <div className="pf-v5-c-page__main-section">
                <EmptyState variant={EmptyStateVariant.xs}>
                    <EmptyStateHeader titleText={_("Loading")} headingLevel="h4" />
                    <EmptyStateBody>
                        <Spinner size="xl" />
                    </EmptyStateBody>
                </EmptyState>
            </div>
        );
    }

    if (svg === null) {
        return (
            <div className="pf-v5-c-page__main-section">
                <EmptyState variant={EmptyStateVariant.xs}>
                    <EmptyStateHeader titleText={_("Failure")} headingLevel="h4" />
                    <EmptyStateBody>
                        {_("Are you sure systemd-analyze is available?")}
                        {_("systemd-analyze failed to load boot info and returned the following error:")}
                        <CodeBlock>
                            <CodeBlockCode id="code-content">{summary.toString()}</CodeBlockCode>
                        </CodeBlock>
                    </EmptyStateBody>
                </EmptyState>
            </div>
        );
    }

    const plotClicked = (event) => {
        const service = event.target.getAttribute("data-service");
        if (service !== null) {
            cockpit.jump(`/system/services#/${service}`, cockpit.transport.host);
        }
    };

    return (
        <div className="pf-v5-c-page__main-section">
            <Card>
                <CardTitle>{ _("Boot Info") }</CardTitle>
                <CardBody>
                    <p>
                        {summary}
                    </p>
                    <List className="legend" isPlain variant={ListVariant.inline}>
                        <ListItem>
                            <div className="legendColor activating" />
                            { _("Activating") }
                        </ListItem>
                        <ListItem>
                            <div className="legendColor active" />
                            { _("Active") }
                        </ListItem>
                        <ListItem>
                            <div className="legendColor deactivating" />
                            { _("Deactivating") }
                        </ListItem>
                        <ListItem>
                            <div className="legendColor security" />
                            { _("Setting up security module") }
                        </ListItem>
                        <ListItem>
                            <div className="legendColor generators" />
                            { _("Generators") }
                        </ListItem>
                        <ListItem>
                            <div className="legendColor unitsload" />
                            { _("Loading unit files") }
                        </ListItem>
                    </List>
                    <div className="chart-container">
                        <div className="chart" role="presentation" onClick={plotClicked} onKeyDown={(_) => null} dangerouslySetInnerHTML={{ __html: svg.outerHTML }} />
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
