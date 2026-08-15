param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedWindowName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient

$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$deadline = (Get-Date).AddSeconds(20)
$appWindow = $null
while ($null -eq $appWindow -and (Get-Date) -lt $deadline) {
  $windows = $desktop.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  foreach ($candidate in $windows) {
    if ($candidate.Current.ProcessId -eq $TargetProcessId -and
        $candidate.Current.Name -eq $ExpectedWindowName) {
      $appWindow = $candidate
      break
    }
  }
  if ($null -eq $appWindow) {
    Start-Sleep -Milliseconds 250
  }
}

if ($null -eq $appWindow) {
  throw "UIAutomation did not expose $ExpectedWindowName for process $TargetProcessId"
}

$interactiveTypes = @(
  'ControlType.Button',
  'ControlType.CheckBox',
  'ControlType.ComboBox',
  'ControlType.Edit',
  'ControlType.Hyperlink',
  'ControlType.ListItem',
  'ControlType.MenuItem',
  'ControlType.RadioButton',
  'ControlType.Slider',
  'ControlType.TabItem',
  'ControlType.TreeItem'
)
$treeDeadline = (Get-Date).AddSeconds(20)
$nodes = @()
$interactive = @()
$unnamed = @()
do {
  $nodes = @($appWindow.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  ))
  $interactive = @($nodes | Where-Object {
    $_.Current.IsControlElement -and
    $interactiveTypes -contains $_.Current.ControlType.ProgrammaticName
  })
  $unnamed = @($interactive | Where-Object { [string]::IsNullOrWhiteSpace($_.Current.Name) })
  if ($interactive.Count -gt 0 -and $unnamed.Count -eq 0) {
    break
  }
  Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $treeDeadline)

if ($interactive.Count -eq 0) {
  throw "UIAutomation exposed no interactive controls after provider synchronization; nodeCount=$($nodes.Count)"
}
if ($unnamed.Count -ne 0) {
  $roles = @($unnamed | ForEach-Object { $_.Current.ControlType.ProgrammaticName } | Sort-Object -Unique)
  throw "UIAutomation exposed $($unnamed.Count) unnamed interactive controls: $($roles -join ', ')"
}

$roleCounts = [ordered]@{}
foreach ($node in $interactive) {
  $role = $node.Current.ControlType.ProgrammaticName.Replace('ControlType.', '')
  if (-not $roleCounts.Contains($role)) {
    $roleCounts[$role] = 0
  }
  $roleCounts[$role] += 1
}

[ordered]@{
  schema = 'opl_desktop_windows_uia_qualification.v1'
  status = 'passed'
  platform = 'win32'
  targetProcessIds = @($TargetProcessId)
  matchedProcessId = $appWindow.Current.ProcessId
  windowName = $appWindow.Current.Name
  nodeCount = $nodes.Count
  interactiveNodeCount = $interactive.Count
  unnamedInteractiveCount = $unnamed.Count
  roles = $roleCounts
} | ConvertTo-Json -Depth 4 -Compress
